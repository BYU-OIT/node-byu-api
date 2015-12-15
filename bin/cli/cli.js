var inquirer            = require('inquirer');
var Promise             = require('bluebird');


/**
 * Provide an inquirer prompt that also joins the config and answers.
 * @param {object} questions
 * @param {function} handler
 */
exports.prompt = function(questions) {
    return new Promise(function(resolve, reject) {
        inquirer.prompt(questions, function(answers) {
            resolve(answers);
        });
    });
};

/**
 * Provide a prompt that makes the user select one of an array of
 * choices and return the choice in the Promise.
 * @param {string} message
 * @param {string[]} choices
 * @returns {Promise}
 */
exports.choices = function(message, choices) {
    return exports
        .prompt([{
            type: 'list',
            name: 'choice',
            message: message,
            choices: choices
        }])
        .then(function(answers) {
            return answers.choice;
        });
};