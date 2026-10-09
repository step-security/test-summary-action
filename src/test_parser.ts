import * as fs from "fs"
import * as util from "util"

import xml2js from "xml2js"

export const TestStatus = {
    None: 0,
    Pass: 1 << 0,
    Fail: 1 << 1,
    Skip: 1 << 2
} as const

export function getTestStatusName(value: number): String {
    switch (value) {
        case TestStatus.Fail:
            return "Fail"
        case TestStatus.Skip:
            return "Skip"
        case TestStatus.Pass:
            return "Pass"
        default:
            return "Unknown"
    }
}

export interface TestCounts {
    passed: number
    failed: number
    skipped: number
}

export interface TestResult {
    counts: TestCounts
    suites: TestSuite[]

    /** If the test runner itself fails, it will set an exception. */
    exception?: string
}

export interface TestSuite {
    name?: string
    timestamp?: string
    filename?: string
    cases: TestCase[]
}

export interface TestCase {
    status: number
    name?: string
    description?: string
    message?: string
    details?: string
    duration?: string
}

export async function parseTap(data: string): Promise<TestResult> {
    const lines = data.trim().split(/\r?\n/)
    // let version = 12
    let header = 0
    let trailer = false

    if (lines.length > 0 && lines[header].match(/^TAP version 13$/)) {
        // version = 13
        header++
    }

    if (lines.length > 0 && lines[header].match(/^1\.\./)) {
        // TODO: capture the plan for validation
        header++
    }

    let testMax = 0
    let num = 0

    const suites: TestSuite[] = []
    let exception: string | undefined = undefined

    let cases = []
    let suitename: string | undefined = undefined

    const counts = {
        passed: 0,
        failed: 0,
        skipped: 0
    }

    for (let i = header; i < lines.length; i++) {
        const line = lines[i]

        let found
        let status = TestStatus.Skip
        let name: string | undefined = undefined
        let description: string | undefined = undefined
        let details: string | undefined = undefined

        if ((found = line.match(/^\s*#(.*)/))) {
            if (!found[1]) {
                continue
            }

            /* a comment starts a new suite */
            if (cases.length > 0) {
                suites.push({
                    name: suitename,
                    cases
                })

                suitename = undefined
                cases = []
            }

            if (suitename) suitename += ` ${found[1].trim()}`
            else suitename = found[1].trim()
            continue
        } else if (
            (found = line.match(
                /^ok(?:\s+(\d+))?\s*-?\s*([^#]*?)\s*#\s*[Ss][Kk][Ii][Pp]\S*(?:\s+(.*?)\s*)?$/
            ))
        ) {
            num = parseInt(found[1])
            status = TestStatus.Skip
            name = found[2] && found[2].length > 0 ? found[2] : undefined
            description = found[3]

            counts.skipped++
        } else if (
            (found = line.match(/^ok(?:\s+(\d+))?\s*-?\s*(?:(.*?)\s*)?$/))
        ) {
            num = parseInt(found[1])
            status = TestStatus.Pass
            name = found[2]

            counts.passed++
        } else if (
            (found = line.match(
                /^not ok(?:\s+(\d+))?\s*-?\s*([^#]*?)\s*#\s*[Tt][Oo][Dd][Oo](?:\s+(.*?)\s*)?$/
            ))
        ) {
            num = parseInt(found[1])
            status = TestStatus.Skip
            name = found[2] && found[2].length > 0 ? found[2] : undefined
            description = found[3]

            counts.skipped++
        } else if (
            (found = line.match(
                /^not ok(?:\s+(\d+))?\s*-?\s*-?\s*(?:(.*?)\s*)?$/
            ))
        ) {
            num = parseInt(found[1])
            status = TestStatus.Fail
            name = found[2]

            counts.failed++
        } else if (line.match(/^Bail out\!/)) {
            const message = line.match(/^Bail out\!(.*)/)

            if (message) {
                exception = message[1].trim()
            }

            break
        } else if (line.match(/^$/)) {
            continue
        } else if (line.match(/^1\.\.\d+/)) {
            // TODO: capture the plan for validation
            trailer = true
            continue
        } else {
            throw new Error(`unknown TAP line ${i + 1}: '${line}'`)
        }

        if (isNaN(num)) {
            num = ++testMax
        } else if (num > testMax) {
            testMax = num
        }

        if (i + 1 < lines.length && lines[i + 1].match(/^ {2}---$/)) {
            i++

            while (i < lines.length && !lines[i + 1].match(/^ {2}\.\.\.$/)) {
                const detail = lines[i + 1].match(/^ {2}(.*)/)

                if (!detail) {
                    throw new Error("invalid yaml in test case details")
                }

                if (details) details += `\n${detail[1]}`
                else details = detail[1]

                i++
            }

            if (i >= lines.length) {
                throw new Error("truncated yaml in test case details")
            }

            i++
        }

        if (trailer) {
            throw new Error("unexpected test results after trailer")
        }

        cases.push({
            status,
            name,
            description,
            details
        })
    }

    suites.push({
        name: suitename,
        cases
    })

    return {
        counts,
        suites,
        exception
    }
}

export async function parseTapFile(filename: string): Promise<TestResult> {
    const readfile = util.promisify(fs.readFile)
    return await parseTap(await readfile(filename, "utf8"))
}

async function parseJunitXml(xml: any): Promise<TestResult> {
    let testsuites

    if ("testsuites" in xml) {
        testsuites = xml.testsuites.testsuite || []
    } else if ("testsuite" in xml) {
        testsuites = [xml.testsuite]
    } else {
        throw new Error("expected top-level testsuites or testsuite node")
    }

    if (!Array.isArray(testsuites)) {
        throw new Error("expected array of testsuites")
    }

    const suites: TestSuite[] = []
    const counts = {
        passed: 0,
        failed: 0,
        skipped: 0
    }

    for (const testsuite of testsuites) {
        const cases = []

        if (!Array.isArray(testsuite.testcase)) {
            continue
        }

        for (const testcase of testsuite.testcase) {
            let status = TestStatus.Pass

            // const id = testcase.$.id
            const classname = testcase.$.classname
            const name = testcase.$.name
            const duration = testcase.$.time

            let failure_or_error
            let message: string | undefined = undefined
            let details: string | undefined = undefined

            if (testcase.skipped) {
                status = TestStatus.Skip

                counts.skipped++
            } else if (
                (failure_or_error = testcase.failure || testcase.error)
            ) {
                status = TestStatus.Fail

                const element = failure_or_error[0]

                message = element.$ ? element.$.message : undefined
                if (typeof element === "string") {
                    details = element
                } else {
                    details = element._
                }

                counts.failed++
            } else {
                counts.passed++
            }

            cases.push({
                status,
                name,
                description: classname,
                message,
                details,
                duration
            })
        }

        suites.push({
            name: testsuite.$.name,
            timestamp: testsuite.$.timestamp,
            filename: testsuite.$.file,
            cases
        })
    }

    return {
        counts,
        suites
    }
}

export async function parseJunit(data: string): Promise<TestResult> {
    const parser = util.promisify(xml2js.parseString)
    const xml: any = await parser(data)

    return await parseJunitXml(xml)
}

export async function parseJunitFile(filename: string): Promise<TestResult> {
    const readfile = util.promisify(fs.readFile)
    return await parseJunit(await readfile(filename, "utf8"))
}

export async function parseTrx(xml: any): Promise<TestResult> {
    if (
        xml.TestRun.$.xmlns !=
            "http://microsoft.com/schemas/VisualStudio/TeamTest/2010" ||
        !Array.isArray(xml.TestRun.Results)
    ) {
        throw new Error("Not a valid .trx file.")
    }

    const suites: TestSuite[] = []
    const counts = {
        passed: 0,
        failed: 0,
        skipped: 0
    }

    for (const result of xml.TestRun.Results) {
        const cases: TestCase[] = []

        if (!Array.isArray(result.UnitTestResult)) {
            continue
        }

        for (const item of result.UnitTestResult) {
            let status = TestStatus.Pass

            // const id = item.$.testId
            const name = item.$.testName
            const duration = item.$.duration
            const outcome = item.$.outcome

            let message: string | undefined = undefined
            let details = ""

            const output = item?.Output?.[0]
            details = `StdOut:${output?.StdOut?.[0]}`

            if (outcome == "Passed") {
                counts.passed++
            } else if (outcome == "Failed") {
                status = TestStatus.Fail
                counts.failed++

                message = output?.ErrorInfo?.[0]?.Message
                details = `StackTrace:${output?.ErrorInfo?.[0]?.StackTrace}\n${
                    details
                }`
            } else {
                status = TestStatus.Pass
                counts.skipped++
            }

            cases.push({
                status,
                name,
                message,
                details,
                duration
            })
        }

        suites.push({
            cases
        })
    }

    return {
        counts,
        suites
    }
}

export async function parseFile(filename: string): Promise<TestResult> {
    const readfile = util.promisify(fs.readFile)
    const parser = util.promisify(xml2js.parseString)

    const data = await readfile(filename, "utf8")

    if (
        data.match(/^TAP version 13\r?\n/) ||
        data.match(/^ok /) ||
        data.match(/^not ok /)
    ) {
        return await parseTap(data)
    }

    const xml: any = await parser(data)

    if ("testsuites" in xml || "testsuite" in xml) {
        return await parseJunitXml(xml)
    }

    if ("TestRun" in xml) {
        return await parseTrx(xml)
    }

    throw new Error(`unknown test file type for '${filename}'`)
}
