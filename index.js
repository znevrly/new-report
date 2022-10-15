const nunjucks = require("nunjucks");
const env = nunjucks.configure('views');
const open = require('open');
const fs = require("fs");
const R = require('ramda');
const Summary = require('./summary');
const Duration = require('./duration');
const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

const regexVariablesPattern = /\$\{(.*?)\}/gm;
const hookVarsPattern = 'hooksVars.';
const profileVarsPattern = 'profileVars.';
const globalVarsPattern = 'globalVars.';
const commonVarsPattern = 'commonVars.';
const localVarsPattern = 'localVars.';
const configVarsPattern = 'configVars.';
const destinationPath = './';
const source = './test.json';

env.addFilter('json', function(str) {
    return JSON.stringify(str, null, 2);
});

const suiteMetaInformation = loadJson(`${destinationPath}suite-meta-information.json`);
const failedScenariosMetaInformation = loadJson(`${destinationPath}failed-scenarios-meta-information.json`);
let features = parseFeatures(loadJson(source));

let failedFeatures = [];
features.map(function (feature) {
    feature.failedScenariosCount = 0;
    feature.elements.forEach(function (element) {
        const normalizedFeatureUri = feature.uri.replace('features\\', '').replace('features/', '').replace('.feature', '').replace('/', '\\');
        const uniqueId = getUniqueId(normalizedFeatureUri, element.name);
        feature.nav_name = normalizedFeatureUri;
        element.uniqueId = uniqueId;
        element.name = evaluateVariables(element.name, suiteMetaInformation, failedScenariosMetaInformation.failedScenarios[uniqueId], false);

        if (failedScenariosMetaInformation.failedScenarios && failedScenariosMetaInformation.failedScenarios[uniqueId]) {
            element.metaInformation = failedScenariosMetaInformation.failedScenarios[uniqueId];
        }

        element.steps.forEach(function (step) {
            // evaluate constiables in steps simple params
            step.name = evaluateVariables(step.name, suiteMetaInformation, failedScenariosMetaInformation.failedScenarios[uniqueId], true);

            // evaluate constiables in steps complex params (table arguments etc.)
            if (step.arguments) {
                for (let i = 0; i < step.arguments.length; i++) {
                    if (step.arguments[i]['rows']) {
                        for (let j = 0; j < step.arguments[i]['rows'].length; j++) {
                            for (let k = 0; k < step.arguments[i]['rows'][j]['cells'].length; k++) {
                                step.arguments[i]['rows'][j]['cells'][k] = evaluateVariables(step.arguments[i]['rows'][j]['cells'][k], suiteMetaInformation, failedScenariosMetaInformation.failedScenarios[uniqueId], true);
                            }
                        }
                    }
                    if (step.arguments[i]['content']) {
                        step.arguments[i]['content'] = evaluateVariables(step.arguments[i]['content'], suiteMetaInformation, failedScenariosMetaInformation.failedScenarios[uniqueId], false);
                    }
                }
            }
        });
        if (element.status === 'failed') {
            feature.failedScenariosCount++;
        }

        // evaluate expression in steps simple params
        features.map(function (feature) {
            feature.elements.forEach(function (element) {
                element.steps.forEach(function (step) {
                    if (failedScenariosMetaInformation.failedScenarios[uniqueId] && failedScenariosMetaInformation.failedScenarios[uniqueId].expressionReplacements && failedScenariosMetaInformation.failedScenarios[uniqueId].expressionReplacements[step.name]) {
                        const expressions = failedScenariosMetaInformation.failedScenarios[uniqueId].expressionReplacements[step.name];
                        expressions.forEach(function (expression) {
                            step.name = addTooltip(step.name, expression.originalValue, expression.value);
                        });
                    }
                });
            });
        });
    });

    feature.selectorId = uuidv4();
    if (feature.status === 'failed') {
        failedFeatures.push(feature);
    }
});
failedFeatures = R.sortBy(R.prop('uri'), failedFeatures);
features = R.sortBy(R.prop('uri'), features);
const stepsSummary = [];
const scenarios = [];
const isCucumber2 = features.every(function (feature) {
    return feature.elements.every(function (scenario) {
        return scenario.type === undefined;
    });
});

durationCounter(features, isCucumber2);

// Extracts steps from the features.
features.map(function (feature, index) {
    feature.index = index;
    const steps = R.compose(R.flatten(), R.map(function (scenario) {
        return scenario.steps;
    }), R.filter(isScenarioType))(feature.elements);

    stepsSummary.push({
        all: 0,
        passed: 0,
        skipped: 0,
        failed: 0,
        undefined: 0
    });

    // Counts the steps based on their status.
    steps.map(function (step) {
        switch (step.result.status) {
            case 'passed':
                stepsSummary[index].all++;
                stepsSummary[index].passed++;
                break;
            case 'failed':
                stepsSummary[index].all++;
                stepsSummary[index].failed++;
                break;
            case 'skipped':
                stepsSummary[index].all++;
                stepsSummary[index].skipped++;
                break;
            case 'undefined':
                stepsSummary[index].all++;
                stepsSummary[index].undefined++;
                break;
            default:
                stepsSummary[index].all++;
                break;
        }
        stepDurationConverter(step, isCucumber2);
    });

    scenarios.push({
        all: 0,
        passed: 0,
        failed: 0
    });

    R.compose(R.map(function (status) {
        scenarios[index].all++;
        scenarios[index][status]++;
    }), R.flatten(), R.map(function (scenario) {
        return scenario.status;
    }), R.filter(isScenarioType))(feature.elements);
});

const scenariosSummary = R.compose(R.filter(isScenarioType), R.flatten(), R.map(function (feature) {
    return feature.elements;
}))(features);

const summary = Summary.calculateSummary(features);
const tags = mappingTags(features);
const tagsArray = createTagsArray(tags, isCucumber2);
let data = {};

let stepsSummaryPassed = 0;
let stepsSummaryFailed = 0;
let stepsSummarySkipped = 0;
let stepsSummaryUndefined = 0;

stepsSummary.forEach(function (step) {
    stepsSummaryPassed += step.passed;
    stepsSummaryFailed += step.failed;
    stepsSummarySkipped += step.skipped;
    stepsSummaryUndefined += step.undefined;
});

data = Object.assign({}, data, {
    suiteMetaInformation: suiteMetaInformation,
    features: features,
    failedFeatures: failedFeatures,
    featuresJson: JSON.stringify(R.pluck('name', scenariosSummary)),
    stepsSummary: stepsSummary,
    stepsSummaryPassed: stepsSummaryPassed,
    stepsSummaryFailed: stepsSummaryFailed,
    stepsSummarySkipped: stepsSummarySkipped,
    stepsSummaryUndefined: stepsSummaryUndefined,
    scenariosSummary: JSON.stringify(scenariosSummary),
    stepsJson: JSON.stringify(stepsSummary),
    scenarios: scenarios,
    scenariosJson: JSON.stringify(scenarios),
    summary: summary,
    tags: tagsArray,
    tagsJson: JSON.stringify(tagsArray),
});

function evaluateVariables(str, suiteMetaInformation, failedScenariosMetaInformation, tooltip) {
    const maxLength = 80;
    return String(str).replace(regexVariablesPattern, function (match) {
        const variableName = match.replace(/\$|\{|\}/g, '');
        let replacedValue = getVariableContent(variableName, suiteMetaInformation, failedScenariosMetaInformation);
        let fullValue = null;
        if (replacedValue && replacedValue.length > maxLength) {
            fullValue = replacedValue;
            replacedValue = _.truncate(replacedValue, {
                'length': maxLength,
                'separator': /,? +/
            });
        }
        if (replacedValue && replacedValue.toString().startsWith('$')) {
            return replacedValue;
        }
        let title = '${' + variableName + '}';
        if (!!fullValue) {
            title = fullValue + '(' + title + ')';
        }
        return tooltip ? '<u class="replacedVariable" title="' + title + '">' + replacedValue + '</u>' : replacedValue;
    });
}

function getVariableContent(str, suiteMetaInformation, failedScenariosMetaInformation) {
    let variableName = str.replace(/\$|\{|\}/g, '');
    if (String(variableName).startsWith(hookVarsPattern)) {
        const key = variableName.replace(hookVarsPattern, '');
        return _.get(suiteMetaInformation.hooksVars, key);
    }
    if (String(variableName).startsWith(profileVarsPattern)) {
        const _key = variableName.replace(profileVarsPattern, '');
        return _.get(suiteMetaInformation.profileVars, _key);
    }
    if (String(variableName).startsWith(commonVarsPattern)) {
        const _key2 = variableName.replace(commonVarsPattern, '');
        return _.get(suiteMetaInformation.commonVars, _key2);
    }
    if (String(variableName).startsWith(configVarsPattern)) {
        const _key3 = variableName.replace(configVarsPattern, '');
        return _.get(suiteMetaInformation.configVars, _key3);
    }
    if (String(variableName).startsWith(globalVarsPattern)) {
        const _key4 = variableName.replace(globalVarsPattern, '');
        // it's object, have to inject ".value" to path because global vars are objects
        const pathValue = '.value';
        if (_key4.indexOf('[') > 0) {
            _key4 = fixVariablePath(_key4, pathValue, _key4.indexOf('['));
            return _.get(suiteMetaInformation.globalVars, _key4);
        } else if (_key4.indexOf('.') > 0) {
            _key4 = fixVariablePath(_key4, pathValue, _key4.indexOf('.'));
            return _.get(suiteMetaInformation.globalVars, _key4);
        }
        if (_.has(suiteMetaInformation.globalVars, _key4)) {
            return _.get(suiteMetaInformation.globalVars, _key4).value;
        }
    }
    if (String(variableName).startsWith(localVarsPattern)) {
        const _key5 = variableName.replace(localVarsPattern, '');
        if (failedScenariosMetaInformation) {
            return _.get(failedScenariosMetaInformation.localVars, _key5);
        }
    }
    return '${' + str + '}';
}

function durationCounter(features, isCucumber2) {
    R.map(function (feature) {
        let duration = R.compose(R.reduce(function (accumulator, current) {
            return accumulator + current;
        }, 0), R.flatten(), R.map(function (step) {
            return step.result && step.result.duration ? step.result.duration : 0;
        }), R.flatten(), R.map(function (element) {
            return element.steps;
        }))(feature.elements);

        if (Duration.isMinuteOrMore(duration, isCucumber2)) {
            // If the test ran for more than a minute, also display minutes.
            feature.duration = Duration.formatDurationInMinutesAndSeconds(duration, isCucumber2);
        } else if (Duration.isMinuteOrLess(duration, isCucumber2)) {
            // If the test ran for less than a minute, display only seconds.
            feature.duration = Duration.formatDurationInSeconds(duration, isCucumber2);
        }
    })(features);
}

function getUniqueId(featureUri, scenarioName) {
    const featureName = _.kebabCase(featureUri.replace('features\\', '').replace('.feature', ''));
    return `${featureName};${_.kebabCase(scenarioName)}`;
}

function loadJson(fileName) {
    return JSON.parse(fs.readFileSync(fileName, 'utf-8').toString());
}

function parseFeatures(features) {
    return sort(features.map(getFeatureStatus).map(parseTags).map(processScenarios()).map(sortScenariosForFeature));
}

function sort(list) {
    return R.sortWith([R.ascend(R.prop('line'))], list);
}

function getFeatureStatus(feature) {
    feature.status = Summary.getFeatureStatus(feature);
    return feature;
}

function parseTags(feature) {
    feature.tags = (feature.tags || []).map(function (tag) {
        return tag.name;
    }).join(', ');
    return feature;
}

function processScenarios() {
    return function (feature) {
        const scenarios = (feature.elements || []).filter(isScenarioType);
        scenarios.forEach(processScenario());
        return feature;
    };
}

function processScenario() {
    return function (scenario) {
        scenario.status = getScenarioStatus(scenario);
        scenario.selectorId = uuidv4();
        scenario.steps = scenario.steps.filter(isValidStep);
    };
}

function isValidStep(step) {
    return step.hidden === undefined || step.result.status.toLocaleLowerCase() === 'failed';
}

function sortScenariosForFeature(feature) {
    feature.elements = sort(feature.elements);
    return feature;
}

function isScenarioType(scenario) {
    return scenario.type === 'scenario' || scenario.keyword === 'Scenario';
}

function getScenarioStatus(scenario) {
    return Summary.getScenarioStatus(scenario);
}

function stepDurationConverter(step, isCucumber2) {
    const duration = step.result.duration || 0;
    step.result.durationFormatted = Duration.formatDurationInMiliseconds(duration, isCucumber2);
}

function mappingTags(features) {
    let tags = {};
    features.map(function (feature) {
        [].concat(feature.tags).map(function (tag) {
            if (!(tag in tags)) {
                tags[tag] = {
                    name: tag,
                    scenarios: {
                        all: 0,
                        passed: 0,
                        failed: 0
                    },
                    steps: {
                        all: 0,
                        passed: 0,
                        failed: 0,
                        skipped: 0
                    },
                    duration: 0,
                    status: 'passed'
                };
            }

            feature.elements.map(function (element) {
                if (isScenarioType(element)) {
                    tags[tag].scenarios.all++;
                    tags[tag].scenarios[element.status]++;
                }

                element.steps.map(function (step) {
                    if (step.result) {
                        if (step.result.duration) {
                            tags[tag].duration += step.result.duration;
                        }
                        tags[tag].steps.all++;
                        tags[tag].steps[step.result.status]++;
                    }
                });
            });

            if (tags[tag].scenarios.failed > 0) {
                tags[tag].status = 'failed';
            }
        });
    });
    return tags;
}

function createTagsArray(tags, isCucumber2) {
    return function (tags) {
        const array = [];

        for (const tag in tags) {
            if (tags.hasOwnProperty(tag)) {
                // Converts the duration from nanoseconds to seconds and minutes (if any)
                const duration = tags[tag].duration;
                if (Duration.isMinuteOrMore(duration, isCucumber2)) {
                    // If the test ran for more than a minute, also display minutes.
                    tags[tag].duration = Duration.formatDurationInMinutesAndSeconds(duration, isCucumber2);
                } else if (Duration.isMinuteOrLess(duration, isCucumber2)) {
                    // If the test ran for less than a minute, display only seconds.
                    tags[tag].duration = Duration.formatDurationInSeconds(duration, isCucumber2);
                }
                array.push(tags[tag]);
            }
        }
        return array;
    }(tags);
}

const res = nunjucks.render('template.njk', { data: data });
const fileName = 'test.html';
fs.writeFile(fileName, res, function (err) {
    if (err) {
        return console.log(err);
    }
    open(fileName, { wait: true });
});
