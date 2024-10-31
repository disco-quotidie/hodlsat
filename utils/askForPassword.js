const readline = require('readline');

function askForPassword(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });

    // Hide input on the terminal by listening to keypress events
    rl.stdoutMuted = true;
    rl._writeToOutput = function _writeToOutput() {
      // if (rl.stdoutMuted) rl.output.write("*");
    };
  });
}

module.exports = askForPassword