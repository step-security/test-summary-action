import { expect } from "chai"

import * as fs from "fs"
import * as util from "util"

import xml2js from "xml2js"

import { TestStatus, parseTrx } from "../src/test_parser.js"
import { resourcePath } from "./common.js"

const trxResourcePath = `${resourcePath}/resources/trx`

async function parseTrxFile(filename: string) {
    const readfile = util.promisify(fs.readFile)
    const parser = util.promisify(xml2js.parseString)
    const xml: any = await parser(await readfile(filename, "utf8"))
    return await parseTrx(xml)
}

describe("trx", async () => {
    it("parses common", async () => {
        const result = await parseTrxFile(`${trxResourcePath}/example.trx`)

        expect(result.counts.passed).to.eql(3)
        expect(result.counts.failed).to.eql(1)
        expect(result.counts.skipped).to.eql(0)

        expect(result.suites.length).to.eql(1)
        expect(result.suites[0].cases.length).to.eql(4)
    })

    it("parses example", async () => {
        const result = await parseTrxFile(`${trxResourcePath}/example.trx`)

        expect(result.counts.passed).to.eql(3)
        expect(result.counts.failed).to.eql(1)
        expect(result.counts.skipped).to.eql(0)

        expect(result.suites.length).to.eql(1)
        expect(result.suites[0].cases.length).to.eql(4)

        expect(result.suites[0].cases[0].status).to.eql(TestStatus.Pass)
        expect(result.suites[0].cases[0].name).to.eql("AddingSeveralNumbers_40")
        expect(result.suites[0].cases[0].details).to.eql(`StdOut:
          Given I have entered 40 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(40) (0.0s)
          And I have entered 50 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(50) (0.0s)
          When I press add
          -> done: Steps.WhenIPressAdd() (0.0s)
          Then the result should be 90 on the screen
          -> done: Steps.ThenTheResultShouldBePass(90) (0.0s)
        `)
        expect(result.suites[0].cases[1].status).to.eql(TestStatus.Pass)
        expect(result.suites[0].cases[1].name).to.eql("AddingSeveralNumbers_60")
        expect(result.suites[0].cases[1].details).to.eql(`StdOut:
          Given I have entered 60 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(60) (0.0s)
          And I have entered 70 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(70) (0.0s)
          When I press add
          -> done: Steps.WhenIPressAdd() (0.0s)
          Then the result should be 130 on the screen
          -> done: Steps.ThenTheResultShouldBePass(130) (0.0s)
        `)
        expect(result.suites[0].cases[2].status).to.eql(TestStatus.Pass)
        expect(result.suites[0].cases[2].name).to.eql("AddTwoNumbers")
        expect(result.suites[0].cases[2].details).to.eql(`StdOut:
          Given I have entered 50 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(50) (0.0s)
          And I have entered 70 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(70) (0.0s)
          When I press add
          -> done: Steps.WhenIPressAdd() (0.0s)
          Then the result should be 120 on the screen
          -> done: Steps.ThenTheResultShouldBePass(120) (0.0s)
        `)
        expect(result.suites[0].cases[3].status).to.eql(TestStatus.Fail)
        expect(result.suites[0].cases[3].name).to.eql("FailToAddTwoNumbers")
        expect(result.suites[0].cases[3].details).to.eql(`StackTrace:
            at Pickles.TestHarness.MSTest.Steps.ThenTheResultShouldBePass(Int32 result) in C:\\dev\\pickles-results-harness\\Pickles.TestHarness\\Pickles.TestHarness.MSTest\\Steps.cs:line 28
            at lambda_method(Closure , IContextManager , Int32 )
            at TechTalk.SpecFlow.Bindings.MethodBinding.InvokeAction(IContextManager contextManager, Object[] arguments, ITestTracer testTracer, TimeSpan& duration)
            at TechTalk.SpecFlow.Bindings.StepDefinitionBinding.Invoke(IContextManager contextManager, ITestTracer testTracer, Object[] arguments, TimeSpan& duration)
            at TechTalk.SpecFlow.Infrastructure.TestExecutionEngine.ExecuteStepMatch(BindingMatch match, Object[] arguments)
            at TechTalk.SpecFlow.Infrastructure.TestExecutionEngine.ExecuteStep(StepArgs stepArgs)
            at TechTalk.SpecFlow.Infrastructure.TestExecutionEngine.OnAfterLastStep()
            at TechTalk.SpecFlow.TestRunner.CollectScenarioErrors()
            at Pickles.TestHarness.MSTest.AdditionFeature.ScenarioCleanup() in C:\\dev\\pickles-results-harness\\Pickles.TestHarness\\Pickles.TestHarness.MSTest\\Addition.feature.cs:line 0
            at Pickles.TestHarness.MSTest.AdditionFeature.FailToAddTwoNumbers() in c:\\dev\\pickles-results-harness\\Pickles.TestHarness\\Pickles.TestHarness.MSTest\\Addition.feature:line 18
          
StdOut:
          Given I have entered 50 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(50) (0.0s)
          And I have entered -1 into the calculator
          -> done: Steps.GivenIHaveEnteredSomethingIntoTheCalculator(-1) (0.0s)
          When I press add
          -> done: Steps.WhenIPressAdd() (0.0s)
          Then the result should be -50 on the screen
          -> error: Assert.NotEqual() Failure
        `)
    })
})
