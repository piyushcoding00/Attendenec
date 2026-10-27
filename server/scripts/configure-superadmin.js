const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const email = 'vorldxteam@gmail.com';
const envPath = path.resolve(__dirname, '../.env');

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal.'));
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let value = '';

    const finish = (error) => {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Setup cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

function setEnvValue(contents, key, value) {
  const lines = contents.split(/\r?\n/);
  const matchingLines = lines.filter((line) => !new RegExp(`^[ \\t]*${key}[ \\t]*=`).test(line));
  while (matchingLines.length && matchingLines[matchingLines.length - 1] === '') {
    matchingLines.pop();
  }
  matchingLines.push(`${key}=${value}`);
  return matchingLines.join('\n');
}

async function main() {
  if (!fs.existsSync(envPath)) {
    throw new Error('server/.env was not found. Copy server/.env.example to server/.env first.');
  }

  const password = await readHidden('Enter the Super Admin password (input is hidden): ');
  const confirmation = await readHidden('Re-enter the password: ');
  if (password.length < 8 || password !== confirmation) {
    throw new Error('Passwords must match and be at least 8 characters long.');
  }

  const hash = await bcrypt.hash(password, 12);
  const original = await fs.promises.readFile(envPath, 'utf8');
  let updated = setEnvValue(original, 'SUPERADMIN_EMAIL', email);
  updated = setEnvValue(updated, 'SUPERADMIN_PASSWORD_HASH', hash);
  await fs.promises.writeFile(envPath, updated, 'utf8');

  console.log(`Configured Super Admin sign-in for ${email}. Restart the backend to apply it.`);
}

module.exports = { readHidden, setEnvValue };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
