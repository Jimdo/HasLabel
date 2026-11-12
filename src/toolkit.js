const fs = require('fs');
const core = require('@actions/core');

// Drop-in for the parts of actions-toolkit this action used (unmaintained since 2022).
function createTools() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  return {
    context: {
      payload: eventPath ? JSON.parse(fs.readFileSync(eventPath, 'utf8')) : {},
    },
    inputs: new Proxy({}, { get: (_, name) => core.getInput(String(name)) }),
    outputs: new Proxy({}, {
      set: (_, name, value) => {
        core.setOutput(String(name), value);
        return true;
      },
    }),
    exit: {
      success: (message) => {
        if (message) core.info(message);
        process.exit(0);
      },
      fail: (message) => {
        if (message) core.error(message);
        process.exit(1);
      },
    },
  };
}

async function run(fn) {
  try {
    await fn(createTools());
  } catch (err) {
    core.setFailed(err.message);
  }
}

module.exports = { run };
