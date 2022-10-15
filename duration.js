'use strict';

function round(decimals, number) {
  return Math.round(number * Math.pow(10, decimals)) / parseFloat(Math.pow(10, decimals));
}

function formatDurationInSeconds(duration, isCucumber2) {
  return isCucumber2 ? round(2, duration / 1000) + ' s' : round(2, duration / 1000000000) + ' s';
}

function formatDurationInMiliseconds(duration, isCucumber2) {
  return isCucumber2 ? round(2, duration / 1000000) + ' ms' : round(2, duration / 1000000) + ' ms';
}

function formatDurationInMinutesAndSeconds(duration, isCucumber2) {
  // eslint-disable-next-line max-len
  return isCucumber2 ? Math.trunc(duration / 60000) + ' m ' + round(2, duration % 60000 / 1000) + ' s' : Math.trunc(duration / 60000000000) + ' m ' + round(2, duration % 60000000000 / 1000000000) + ' s';
}

function isMinuteOrMore(duration, isCucumber2) {
  return isCucumber2 ? duration && duration / 60000 >= 1 : duration && duration / 60000000000 >= 1;
}

function isMinuteOrLess(duration, isCucumber2) {
  return isCucumber2 ? duration && duration / 60000 < 1 : duration && duration / 60000000000 < 1;
}

module.exports = {
  formatDurationInSeconds: formatDurationInSeconds,
  formatDurationInMinutesAndSeconds: formatDurationInMinutesAndSeconds,
  formatDurationInMiliseconds: formatDurationInMiliseconds,
  isMinuteOrMore: isMinuteOrMore,
  isMinuteOrLess: isMinuteOrLess
};