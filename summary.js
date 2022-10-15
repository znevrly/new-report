'use strict';

const add = function add(a, b) {
    return a + b;
};
const sum = function sum(arr) {
    return arr.reduce(add, 0);
};
const validStep = function validStep(step) {
    return step.hidden === undefined || step.result.status.toLocaleLowerCase() === 'failed';
};
const featurePassed = function featurePassed(feature) {
    return feature.status === 'passed';
};
const stepPassed = function stepPassed(step) {
    return step.result.status.toLocaleLowerCase() === 'passed';
};
const stepFailed = function stepFailed(step) {
    return step.result.status.toLocaleLowerCase() === 'failed';
};
const stepSkipped = function stepSkipped(step) {
    return step.result.status.toLocaleLowerCase() === 'skipped';
};
const isScenarioType = function isScenarioType(scenario) {
    return scenario.type === 'scenario' || scenario.keyword === 'Scenario';
};
const getStatusText = function getStatusText(success) {
    return success ? 'passed' : 'failed';
};
const getValidSteps = function getValidSteps(scenario) {
    return (scenario.steps || []).filter(validStep);
};
const getNumStepsForScenario = function getNumStepsForScenario(scenario) {
    return getValidSteps(scenario).length;
};
const getNumPassedStepsForScenario = function getNumPassedStepsForScenario(scenario) {
    return getValidSteps(scenario).filter(stepPassed).length;
};
const getNumFailedStepsForScenario = function getNumFailedStepsForScenario(scenario) {
    return getValidSteps(scenario).filter(stepFailed).length;
};
const getNumSkippedStepsForScenario = function getNumSkippedStepsForScenario(scenario) {
    return getValidSteps(scenario).filter(stepSkipped).length;
};
const getScenarios = function getScenarios(feature) {
    return (feature.elements || []).filter(isScenarioType);
};

function getScenarioResult(scenario) {
    return {
        numSteps: getNumStepsForScenario(scenario),
        passedSteps: getNumPassedStepsForScenario(scenario),
        failedSteps: getNumFailedStepsForScenario(scenario),
        skippedSteps: getNumSkippedStepsForScenario(scenario)
    };
}

function getFeatureResult(feature) {
    const scenarios = getScenarios(feature);
    const scenarioResults = scenarios.map(getScenarioResult);
    const passedScenarios = sum(scenarioResults.map(function (res) {
        return res.numSteps === res.passedSteps ? 1 : 0;
    }));
    const failedScenarios = sum(scenarioResults.map(function (res) {
        return res.passedSteps === res.numSteps ? 0 : 1;
    }));

    return {
        numScenarios: scenarios.length,
        passedScenarios: passedScenarios,
        failedScenarios: failedScenarios
    };
}

exports.getFeatureStatus = function (feature) {
    const result = getFeatureResult(feature);
    return getStatusText(result.failedScenarios === 0);
};

exports.getScenarioStatus = function (scenario) {
    const result = getScenarioResult(scenario);
    return getStatusText(result.failedSteps === 0 && result.skippedSteps === 0);
};

exports.calculateSummary = function (features) {
    const featureResults = features.map(getFeatureResult);
    const featuresPassed = sum(features.map(featurePassed));
    const scenariosPassed = sum(featureResults.map(function (result) {
        return result.passedScenarios;
    }));
    const scenariosFailed = sum(featureResults.map(function (result) {
        return result.failedScenarios;
    }));

    return {
        totalFeatures: features.length,
        featuresPassed: featuresPassed,
        featuresFailed: features.length - featuresPassed,
        totalScenarios: scenariosPassed + scenariosFailed,
        scenariosPassed: scenariosPassed,
        scenariosFailed: scenariosFailed,
        status: scenariosFailed === 0 ? 'passed' : 'failed'
    };
};