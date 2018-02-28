const minimist = require('minimist');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const rootPackageFile = require('../package.json');
const args = minimist(process.argv.slice(2));
const rimraf = require('rimraf');

const doesExist = (packageName) => {
  try {
    fs.accessSync(packageName, fs.constants.R_OK);
    console.log('Package already exists, choose different name');
    return true;
  } catch (err) {
    console.log('Package name is available, continue bootstrap');
    return false;
  }
};

const rmFolder = (folderName) =>
  new Promise((resolve => rimraf(folderName, () => resolve())));

const rmFile = (fileName) =>
  fs.unlinkSync(fileName);


const overWriteRootPackageFile = (content) => {
  return fs.writeFileSync(
    'package.json',
    JSON.stringify(content, null, 2)
  );
};

const patchWorkspaces = (packageName) => {
  // clone deep
  const newPackageFile = JSON.parse(JSON.stringify(rootPackageFile));
  newPackageFile.workspaces.push(packageName);
  return overWriteRootPackageFile(newPackageFile);
};

const installModules = () => {
  return new Promise((resolve, reject) => {
    const install = spawn(
      'yarn install',
      {
        stdio: 'inherit',
      }
    );
    install.on('error', (err) => reject(err));

    install.on('exit', (code) => resolve(code));
  });
};

const ejectTheApp = (packageName) => {
  return new Promise((resolve, reject) => {
    process.chdir(packageName);
    const eject = spawn(
      'yarn eject',
      {
        cwd: path.resolve('..', packageName),
        stdio: 'inherit',
      }
    );
    eject.on('error', (err) => reject(err));

    eject.on('exit', (code) => resolve(code));
  });
};

const initApp = (appName) => {
  return new Promise((resolve, reject) => {
    const installApp = spawn(
      'npx',
      ['create-react-app', appName],
      {
        stdio: 'inherit',
      }
    );
    installApp.on('error', (err) => reject(err));

    installApp.on('exit', (code) => resolve(code));
  });
};

const rollChangesBack = (packageName) => {
  // write back initial file content
  overWriteRootPackageFile(rootPackageFile);
  return rmFolder(packageName);
};

process.on('uncaughtException', (err) => {
  console.error('Rolling changes back because of the uncaught error', err);
  rollChangesBack(args.component);
});

//bootstrap a component
// yarn bootstrap --component component-name

const main = async () => {
  if (args.component) {
    const packageName = args.component;
    if (!doesExist(packageName)) {
      try {
        await initApp(packageName);
      } catch (error) {
        rollChangesBack(packageName);
        return console.error('initialization failed', error);
      }
      try {
        await ejectTheApp(packageName);
      } catch (error) {
        rollChangesBack(packageName);
        return console.error('ejection failed', error);
      }
      patchWorkspaces(packageName);
      //make it compatible with the yarn workspaces
      rmFolder(path.resolve(packageName, 'node_modules'));
      rmFile(path.resolve(packageName, 'yarn.lock'));
      try {
        await installModules();
      } catch (error) {
        rollChangesBack(packageName);
        return console.error('module installation failed', error);
      }
      console.log('-- Bootstrap completed --');
      process.exit();
    }
  }
};

if (!(args.component)) {
  return console.error('You need to provide a component name (--component component-name)');
}

main();
