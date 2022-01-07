var express = require('express');
var router = express.Router();
const path = require('path');
var db = require('../modules/db-connection');
var sql = require('../sql');
var _fs = require('fs');
const fs = require('fs-extra');
const rs = require('randomstring');
const {  exec } = require('child_process');
const { resolve } = require('path');
var checkLoginMiddleWare = require('../modules/check-login-middleware');
const PROBLEM_PATH = process.env.DEBUG_TEMP_PATH;
const moment = require('moment');


const Logger = require('../modules/logger');
const logger = new Logger('problem-compile');

router.use(checkLoginMiddleWare.injectUerforAPI)

// By Normal API
router.post('/compile-problem', async function (req, res) {
    try {
        const { sourceCode, language, problemId } = req.body
        const { id: userId } = req.user._user[0];

        logger.setLogData({ userId, data: req.body })
        let [testCases] = await db.query(sql.problems.selectTestCaseByProblemId, [problemId]);
        let correctCount = 0;
        logger.info('request /compile-problem');

        //일단 이렇게 간단함
        const userDebugPath = path.resolve(PROBLEM_PATH, userId.toString());
        if (!_fs.existsSync(userDebugPath)) {
            _fs.mkdirSync(userDebugPath);
        }

        const projectDebugPath = path.resolve(userDebugPath, problemId.toString());
        if (!_fs.existsSync(projectDebugPath)) {
            _fs.mkdirSync(projectDebugPath);
        }

        const promises = testCases.map(testCase => {
            return new Promise(async (resolve, reject) => {
                const hash = rs.generate(10);
                const tempPath = path.resolve(projectDebugPath, hash);
                _fs.mkdirSync(tempPath);

                setTimeout(() => {
                    _fs.rmdirSync(tempPath, { recursive: true });
                }, 8000);

                writeSourceToFile(sourceCode, language, tempPath)
                try {
                    let result;
                    if (language === "c") {
                        result = await compileC('main.c', tempPath, testCase.input)
                    } else if (language === 'cpp') {
                        result = await compilePlusplus('main.cpp', tempPath, testCase.input)
                    } else if (language === 'python') {
                        result = await compilePython('main.py', tempPath, testCase.input)
                    } else if (language === 'java') {
                        result = await compileJava('Main.java', tempPath, testCase.input)
                    }
                    result = String(result).replace(/(\r\n|\n|\r)/gm, "");
                    if (result !== undefined && result.includes(testCase.output)) {
                        correctCount++;
                    }
                    const [problemSubmit] = await db.query(sql.problems.selectProblemSubmit, [userId, problemId]);
                    //제출했으면 업데이트
                    if (problemSubmit.length !== 0) {
                        await db.query(sql.problems.updateProblemSubmit, [1, correctCount === testCases.length, `${correctCount}/${testCases.length}`, `${userId}\/${problemId}`, problemId, userId])
                    } else {
                        await db.query(sql.problems.insertProblemSubmit, [userId, problemId, 1, correctCount === testCases.length, `${correctCount}/${testCases.length}`, `${userId}\/${problemId}`, 1])
                    }
                    resolve("successful");
                } catch (error) {
                    console.log("compile-error", error);
                    reject(error)
                }
            })
        })

        let compileError;

        for (let i = 0; i < promises.length; i++) {
            await promises[i].then((status) => console.log(status)).catch(error => compileError = error)
        }

        if (compileError) {
            logger.error("error /compile-problem", compileError)
            res.status(200).send({
                result: false,
                data: [],
                message: 'compile-fail'
            })
            return;
        } else {
            logger.info('return /compile-problem', { correctCount, count: testCases.length });
            res.status(200).send({
                result: true,
                data: { correctCount, count: testCases.length },
                message: 'compile-successful'
            })
            return;
        }
    } catch (error) {
        logger.error("/compile-problem", error)
        res.status(500).send({
            result: false,
            data: [],
            message: error
        })
    }
})

function compileC(filename, ROOT, testCaseInput) {
    try {
        return new Promise(function (res, rej) {
            let printf = "";
            let compileCmd = exec(`clang-7 -pthread -lm -o ${ROOT}/main ${ROOT}/${filename}`, function (error, stdout, stderr) {
                console.log(`clang-7 -pthread -lm -o ${ROOT}/main ${ROOT}/${filename}`)
                if (error) {
                        console.log("ERROR stack",error.stack);
                        console.log('Error code: ' + error.code);
                        console.log('Signal received: ' + error.signal);
                    rej(error.message);
                } else {
                    let runCmd = exec(`echo ${testCaseInput} | ${ROOT}/main`, function (error, stdout, stderr) {
                        if (error) {
                            rej(error.code);
                        }
                        printf = stdout
                        res(printf)
                    });
                    runCmd.on('exit', function (code) { });
                }
            });
            compileCmd.on('exit', function (code) { });
        })
    } catch (error) {
        console.log("===================", error, "===================")
    }
}
function compilePlusplus(filename, ROOT, testCaseInput) {
    return new Promise(function (res, rej) {
        let printf = "";
        let compileCmd = exec(`g++ -o ${ROOT}/main ${ROOT}/${filename}`, function (error, stdout, stderr) {
            if (error) {
                rej(error.message);
            } else {
                let runCmd = exec(`echo ${testCaseInput} | ${ROOT}/main`, function (error, stdout, stderr) {
                    if (error) {
                        rej(error.code);
                        // console.log(error.stack);
                    }
                    printf = stdout
                    res(printf)
                });
                runCmd.on('exit', function (code) { });
                // res(true)
            }
        });
        compileCmd.on('exit', function (code) { });
    })
}

function compilePython(filename, ROOT, testCaseInput) {
    return new Promise(function (res, rej) {
        let printf = "";
        let compileCmd = exec(`echo ${testCaseInput} | python3 ${ROOT}/${filename}`, function (error, stdout, stderr) {
            if (error) {
                //console.log(error)
                rej(error.message);
            } else {
                printf = stdout
                res(printf)
            }
        });
        compileCmd.on('exit', function (code) { });
    })
}

function compileJava(filename, ROOT, testCaseInput) {
    return new Promise(function (res, rej) {
        let printf = "";
        let compileCmd = exec(`javac ${ROOT}/${filename}`, function (error, stdout, stderr) {
            console.log(`javac ${ROOT}/${filename}`)
            if (error) {
                //console.log(error)
                rej(error.message);
            } else {
                let runCmd = exec(`
                cd ${ROOT} &&
                echo ${testCaseInput} | java Main
                `, function (error, stdout, stderr) {
                    if (error) {
                        rej(error.code);
                        // console.log(error.stack);
                    }
                    printf = stdout
                    res(printf)
                });
                runCmd.on('exit', function (code) { });
            }
        });
        compileCmd.on('exit', function (code) { });
    })
}
const writeSourceToFile = (source, category, tempPath) => {
    let filename;
    switch (category) {
        case "c":
            filename = "main.c"; break;
        case "cpp":
            filename = "main.cpp"; break;
        case "java":
            filename = "Main.java"; break;
        case "python":
            filename = "main.py"; break;
        default: filename = undefined; break;
    }
    if (filename === undefined) return null;
    const mainFilePath = path.resolve(tempPath, filename);
    fs.createFileSync(mainFilePath);
    fs.writeFileSync(mainFilePath, Buffer.from(source));
}
const saveFile = (source, tempPath) => {
    const mainFilePath = path.resolve(tempPath);
    fs.createFileSync(mainFilePath);
    fs.writeFileSync(mainFilePath, Buffer.from(source));
}

module.exports = router;