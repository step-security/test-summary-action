import * as fs from "fs"
import * as util from "util"
import * as core from "@actions/core"
import * as glob from "glob-promise"

import { TestResult, TestStatus, parseFile } from "./test_parser"
import { dashboardResults, dashboardSummary } from "./dashboard"
import axios, { isAxiosError } from "axios"

async function validateSubscription(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  let repoPrivate: boolean | undefined

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    repoPrivate = eventData?.repository?.private
  }

  const upstream = 'test-summary/action'
  const action = process.env.GITHUB_ACTION_REPOSITORY
  const docsUrl =
    'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions'

  core.info('')
  core.info('[1;36mStepSecurity Maintained Action[0m')
  core.info(`Secure drop-in replacement for ${upstream}`)
  if (repoPrivate === false)
    core.info('[32m✓ Free for public repositories[0m')
  core.info(`[36mLearn more:[0m ${docsUrl}`)
  core.info('')

  if (repoPrivate === false) return

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const body: Record<string, string> = {action: action || ''}
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      {timeout: 3000}
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        `[1;31mThis action requires a StepSecurity subscription for private repositories.[0m`
      )
      core.error(
        `[31mLearn how to enable a subscription: ${docsUrl}[0m`
      )
      process.exit(1)
    }
    core.info('Timeout or API not reachable. Continuing to next step.')
  }
}

async function run(): Promise<void> {
    try {
        await validateSubscription()
        const pathGlobs = core.getInput("paths", { required: true })
        const outputFile =
            core.getInput("output") || process.env.GITHUB_STEP_SUMMARY || "-"
        const showList = core.getInput("show")

        /*
         * Given paths may either be an individual path (eg "foo.xml"),
         * a path glob (eg "**TEST-*.xml"), or may be newline separated
         * (from a multi-line yaml scalar).
         */
        const paths = []

        for (const path of pathGlobs.split(/\r?\n/)) {
            if (glob.hasMagic(path)) {
                paths.push(...(await glob.promise(path)))
            } else {
                paths.push(path.trim())
            }
        }

        let show = TestStatus.Fail
        if (showList) {
            show = 0

            for (const showName of showList.split(/,\s*/)) {
                if (showName === "none") {
                    continue
                } else if (showName === "all") {
                    show = TestStatus.Pass | TestStatus.Fail | TestStatus.Skip
                    continue
                }

                const showValue = (TestStatus as any)[
                    showName.replace(
                        /^([a-z])(.*)/,
                        (m, p1, p2) => p1.toUpperCase() + p2
                    )
                ]

                if (!showValue) {
                    throw new Error(`unknown test type: ${showName}`)
                }

                show |= showValue
            }
        }

        /*
         * Show the inputs for debugging
         */

        if (core.isDebug()) {
            core.debug("Paths to analyze:")

            for (const path of paths) {
                core.debug(`: ${path}`)
            }

            core.debug(
                `Output file: ${outputFile === "-" ? "(stdout)" : outputFile}`
            )

            let showInfo = "Tests to show:"
            if (show === TestStatus.Fail) {
                showInfo += " none"
            }
            for (const showName in TestStatus) {
                const showType = Number(showName)

                if (!isNaN(showType) && (show & showType) == showType) {
                    showInfo += ` ${TestStatus[showType]}`
                }
            }
            core.debug(showInfo)
        }

        /* Analyze the tests */

        const total: TestResult = {
            counts: { passed: 0, failed: 0, skipped: 0 },
            suites: [],
            exception: undefined
        }

        for (const path of paths) {
            const result = await parseFile(path)

            total.counts.passed += result.counts.passed
            total.counts.failed += result.counts.failed
            total.counts.skipped += result.counts.skipped

            total.suites.push(...result.suites)
        }

        /* Create and write the output */

        let output = dashboardSummary(total)

        if (show) {
            output += dashboardResults(total, show)
        }

        if (outputFile === "-") {
            console.log(output)
        } else {
            const writefile = util.promisify(fs.writeFile)
            await writefile(outputFile, output)
        }

        core.setOutput("passed", total.counts.passed)
        core.setOutput("failed", total.counts.failed)
        core.setOutput("skipped", total.counts.skipped)
        core.setOutput(
            "total",
            total.counts.passed + total.counts.failed + total.counts.skipped
        )
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message)
        } else if (error !== null && error !== undefined) {
            core.setFailed(error as string)
        } else {
            core.setFailed("unknown error")
        }
    }
}

run()
