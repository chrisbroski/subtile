const fs = require('fs').promises;
const fsSync = require('fs');

const endure = {};

/*
Make an npm repo
* where is default data path? in node_modules?

gzip backup

If a corrupted backup is found, give warning on load

Is the save() really needed? Maybe periodically check for changes (hash the object?) You could still save explicitly, but for most things I don't see the need. Especially since it saves immediately on close. At least have a fallback to check every 10 min or so. Little harm there.

Maybe even check the hash on save. It could trade some CPU and RAM for less disc writes. It's an optimization I think I'd need to measurably verify before bothering with.
*/

// Global state
var saveTimer;
var saveDelay;
var backupTimer;
var backupDelay;

function save(exit) {
    var dataPath = `${__dirname}/../../data/data.json`;
    var backupPath = `${__dirname}/../../data/data.json.backup`;
    // This is only meant to be used on exit, so no data is lost
    if (exit) {
        fsSync.writeFileSync(dataPath, JSON.stringify(endure.db, null, "    "));
        return;
    }

    if (saveTimer) {
        return;
    }
    saveTimer = setTimeout(function () {
        console.log('Persisting data...');
        fs.writeFile(dataPath, JSON.stringify(endure.db, null, "    "), (err) => {
            if (err) {
                console.log(err);
            }
            console.log('Data saved.');
            saveTimer = null;
        });
        // start the backup timer
        if (backupTimer) {
            return;
        }
        backupTimer = setTimeout(function () {
            console.log('Backing up data...');
            fs.writeFile(backupPath, JSON.stringify(endure.db), (err) => {
                if (err) {
                    console.log(err);
                }
                console.log('Data backed up.');
                backupTimer = null;
            });
        }, backupDelay);
    }, saveDelay);
}

function getDefaultData(startData) {
    var jsonStart;

    if (!startData) {
        return {};
    }

    if (typeof startData == 'object') {
        return startData;
    }

    try {
        jsonStart = JSON.parse(startData);
    } catch (e) {
        console.log(e);
        console.log('startData is invalid. Using blank object.');
        jsonStart = {};
    }

    return jsonStart;
}

endure.load = async function (dataFilePath, startData, saveLag, backupLag) {
    // where is the default data file path? Or is it required?
    var dataFile = `${dataFilePath}/data.json`;
    saveDelay = saveLag || 10000;
    backupDelay = backupLag || 605000;

    // get a string version of the data from disc
    var strData = await fs.readFile(dataFile, 'utf8').catch(e => {
        console.log("No data.json found. Looking for backup");
    });
    // console.log(strData);
    if (!strData) {
        dataFile = `${dataFilePath}/data.json.backup`;
        strData = await fs.readFile(dataFile, 'utf8').catch(e => {
            console.log("No data.json.backup found. Creating from startData.");
            endure.db = getDefaultData(startData);
        });
    }
    if (endure.db) {
        return;
    }

    // parse data string into JSON. If invalid, try the backup
    var backupFileName;
    try {
        endure.db = JSON.parse(strData);
    } catch (e) {
        console.log('data.json is corrupt. Looking for backup.');
        if (dataFile === `${dataFilePath}/data.json`) {
            // make backup copy of data.json with timestamp
            backupFileName = `${dataFilePath}/data.json.invalid${+(new Date)}.backup`;
            console.log(`Backing up corrupt data ${backupFileName}`);
            await fs.copyFile(dataFile, backupFileName, ).catch(e => {
                console.log('error writing backup data');
                console.log(e);
            });
            // check for backup
            dataFile = `${dataFilePath}/data.json.backup`;
            strData = await fs.readFile(dataFile, 'utf8').catch(function () {
                console.log("data.json.backup file not found. Creating from startData.");
                endure.db = getDefaultData(startData);
                return;
            });
            if (endure.db) {
                return;
            }

            // Try parsing the backup file
            try {
                endure.db = JSON.parse(strData);
            } catch (e) {
                console.log("data.json.backup file is corrupt.");
                backupFileName = `${dataFilePath}/data.json.backup.invalid${+(new Date)}.backup`;
                await fs.copyFile(dataFile, backupFileName).catch(e => {
                    console.log(`error writing backup file ${backupFileName}`);
                    console.log(e);
                });
                endure.db = getDefaultData(startData);
                return;
            }
        } else {
            // The backup file is corrupt
            console.log("data.json.backup file is corrupt.");
            await fs.writeFile(`${dataFilePath}/data.json.backup.invalid${+(new Date)}.backup`);
            endure.db = getDefaultData(startData);
            return;
        }
    }
};

endure.save = save;
endure.db = null;

module.exports = endure;
