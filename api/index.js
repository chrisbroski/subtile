// Standard libs
const http = require('http');
const fs = require("fs").promises;
// const util = require('util');
const url = require('url');

// const readFile = util.promisify(fs.readFile);

// npm modules
require('dotenv').config();

// Configuration defaults
process.env.PORT = process.env.PORT || 29170;
process.env.SUBDIR = process.env.SUBDIR || "/api";

// Custom libs
const main = require('./inc/main.js');
const endure = require('./inc/endure.js');

// Resources
const auth = require('./resource/auth/auth.js');
const site = require('./resource/site/site.js');
const user = require('./resource/user/user.js');
const example = require('./resource/example/example.js');

// Application state
const ASSET = {};
const TEMPLATE = {};

function removeQs(fullUrl) {
    if (!fullUrl) {
        return '';
    }
    if (fullUrl.indexOf('?') === -1) {
        return fullUrl;
    }
    return fullUrl.slice(0, fullUrl.indexOf('?'));
}

function regexExtract(pattern, source) {
    var value = "";
    var reId = new RegExp(pattern, "i");
    var result;

    if (source.slice(-1) !== "/") {
        source = source + "/";
    }

    result = reId.exec(source);
    if (result) {
        value = result[1];
    }
    return decodeURIComponent(value);
}

function extractFileType(path) {
    var lastDot;
    if (!path) {
        return "";
    }
    lastDot = path.lastIndexOf(".");
    if (lastDot === -1) {
        return "";
    }
    return path.slice(lastDot + 1);
    // from last slash to either end, ?, or #
}

function getPath(pathname) {
    var path;
    var qs = main.parseQs(pathname, true);
    var raw = pathname;
    pathname = removeQs(pathname);
    path = pathname.slice(process.env.SUBDIR.length);
    if (!path) {
        return {"pathname": pathname, id: "", resource: ""};
    }

    var resource = regexExtract("^\/([^\/]+)[\/]", path);;
    return {
        "id": regexExtract('^\/' + resource + '\/([^\/]+)', path),
        "pathname": decodeURI(pathname),
        "resource": resource,
        "path": path,
        "type": extractFileType(path),
        "qs": qs,
        "raw": raw
    };
}

function authenticate(req, rsp, path) {
    var cookies, userid;
    var userData;

    var exceptions = ["login", "password", "forgot-password", "start"];
    if (exceptions.indexOf(path.resource) > -1) {
        return true;
    }

    cookies = main.parseCookie(req.headers.cookie);
    if (!cookies.user) {
        return auth.fail(req, rsp, 'Not logged in', endure.db, process.env.SUBDIR);
    }
    userid = cookies.user;

    userData = endure.db.user[userid];
    if (!userData) {
        return auth.fail(req, rsp, 'User id not found', endure.db, process.env.SUBDIR);
    }

    if (!userData.hash) {
        return auth.fail(req, rsp, 'User not able to log in. Please contact your moderator.', endure.db, process.env.SUBDIR);
    }

    if (main.hash(userData.password + userid, userData.salt) !== cookies.token) {
        return auth.fail(req, rsp, 'Invalid token', endure.db, process.env.SUBDIR);
    }

    return true;
}

/*
function isFileForm(req) {
    var contentType = req.headers['content-type'];
    if (contentType.length > 18 && contentType.slice(0, 19) === 'multipart/form-data') {
        return true;
    }
    return false;
}*/

function homePage(req, rsp) {
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.home, endure.db.band, endure.db));
    return;
}

function getDelete(req, rsp) {
    var searchParams = url.parse(req.url, true).query;

    if (!endure.db[searchParams.resource][searchParams.id]) {
        return main.notFound(rsp, req.url, 'GET', req, endure.db);
    }

    var deleteData = {
        "resourceName": searchParams.resource,
        "id": searchParams.id,
        "back": req.headers.referer
    };
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.delete, deleteData, endure.db));
}

function rspPost(req, rsp, path, body) {
    if (path.path === '/login') {
        return auth.login(req, rsp, body, endure.db, process.env.SUBDIR);
    }

    if (path.resource === "password") {
        return auth.set(req, rsp, path.id, body, endure.db, endure.save);
    }

    if (path.resource === 'example') {
        return example.create(req, rsp, body, endure.db, endure.save, process.env.SUBDIR);
    }

    if (path.resource === 'user') {
        return user.create(req, rsp, body);
    }

    if (path.resource === 'start') {
        // put in user resource. No token necessary
        return site.setup(req, rsp, body);
    }

    return main.notFound(rsp, req.url, 'POST', req, endure.db);
}

function rspPut(req, rsp, path, body) {
    if (path.resource === 'user') {
        return user.update(req, rsp, path.id, body);
    }

    if (path.resource === 'site') {
        return site.update(req, rsp, body);
    }

    if (path.resource === 'example') {
        return example.update(req, rsp, path.id, body, endure.db, endure.save, process.env.SUBDIR);
    }

    if (path.resource === 'password') {
        if (path.id) {
            return auth.update(req, rsp, path.id, body, endure.db, endure.save, process.env.SUBDIR);
        }
        return;
    }

    return main.notFound(rsp, req.url, 'PUT', req, endure.db);
}

function rspDelete(req, rsp, path) {
    if (path.resource === 'user') {
        return user.remove(req, rsp, path.id);
    }

    if (path.resource === 'example') {
        return example.remove(req, rsp, path.id, endure.db, endure.save, process.env.SUBDIR);
    }

    if (path.resource === `password`) {
        return auth.reset(req, rsp, path.id, endure.db, endure.save, process.env.SUBDIR);
    }

    return main.notFound(rsp, req.url, 'DELETE', req, endure.db);
}

function rspGet(req, rsp, path) {
    // assets
    if (path.path === '/favicon.ico') {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'image/png'});
        rsp.end(ASSET.favicon);
        return;
    }
    if (path.path === '/main.css') {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(ASSET.mainCss);
        return;
    }
    if (path.path === '/custom.css') {
        return site.getCss(req, rsp, true);
    }
    // if (path.path === '/header.pht') {
    //     return site.getHeader(req, rsp, db);
    // }
    if (path.pathname === `/ajax-tool`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(ASSET.ajaxTool);
        return;
    }
    if (path.resource === 'delete') {
        return getDelete(req, rsp, endure.db, process.env.SUBDIR);
    }

    // authentication
    if (path.path === '/login') {
        return auth.get(req, rsp, endure.db, process.env.SUBDIR);
    }
    if (path.path === '/') {
        return homePage(req, rsp);
    }
    if (path.path === '/logout') {
        return auth.logout(req, rsp, endure.db);
    }
    if (path.resource === "password") {
        return auth.getPassword(req, rsp, path.id, endure.db, process.env.SUBDIR);
    }

    // Add resources here
    if (path.resource === 'site') {
        return site.get(req, rsp);
    }
    if (path.resource === 'user') {
        return user.get(req, rsp, path.id);
    }
    if (path.resource === 'example') {
        return example.get(req, rsp, path.id, endure.db, process.env.SUBDIR);
    }

    return main.notFound(rsp, path.pathname, 'GET', req, endure.db);
}

function getMethod(req, body) {
    var method = req.method;
    var methodsAllowed = ['DELETE', 'PUT', 'PATCH'];
    if (method === 'POST') {
        if (methodsAllowed.indexOf(body.method) > -1) {
            method = body.method;
        }
    }
    return method;
}

function parseBody(req, body) {
    var contentType = '';
    var parsedBody = {};
    if (!body) {
        return parsedBody;
    }
    if (req.headers['content-type']) {
        contentType = req.headers['content-type'].split(";")[0];
    }

    if (contentType === 'application/json') {
        try {
            parsedBody = JSON.parse(body);
        } catch (e) {
            console.log(e);
            console.log(body);
        }
        return parsedBody;
    }

    return main.parseQs(body);
}

function allowedBeforeSetup(method, path) {
    if (path.type === "css" || path.type === "ico") {
        return false;
    }
    if (method === "POST" && path.resource === "start") {
        return false;
    }
    return true;
}

function routeMethods(req, rsp, body) {
    var parsedBody = parseBody(req, body);
    var method = getMethod(req, parsedBody);
    var path = getPath(req.url);

    // To trigger a 500 for testing:
    // if (req.method !== 'OPTIONS') {
    //     rsp.writeHead(500, {'Content-Type': 'text/plain'});
    //     rsp.end("Oh, the humanity!");
    //     return;
    // }
    if (method === 'OPTIONS') {
        rsp.writeHead(200, {
            'Content-Type': 'text/plain',
            'Allow': "GET,POST,PUT,DELETE,OPTIONS",
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            "Access-Control-Allow-Headers": "Origin, Content-Type, Accept"
        });
        rsp.end('OK');
        return;
    }

    // redirect for initial setup
    if (allowedBeforeSetup(method, path) && endure.db.user && Object.keys(endure.db.user) < 1) {
        return site.start(req, rsp);
    }

    if (method === 'GET') {
        return rspGet(req, rsp, path);
    }

    if (!authenticate(req, rsp, path)) {
        return;
    }
    if (method === 'POST') {
        return rspPost(req, rsp, path, parsedBody);
    }
    if (method === 'PUT') {
        return rspPut(req, rsp, path, parsedBody);
    }

    if (method === 'DELETE') {
        return rspDelete(req, rsp, path);
    }

    rsp.writeHead(405, {'Content-Type': 'text/plain'});
    rsp.end('GET, POST, PUT, DELETE, and OPTIONS only.');
}

function collectReqBody(req, rsp) {
    var body = [];

    req.on('data', function (chunk) {
        body.push(chunk);
    }).on('end', function () {
        body = Buffer.concat(body).toString();
        routeMethods(req, rsp, body);
    });
}

function init() {
    process.stdin.resume();
    process.on('SIGINT', function () {
        if (endure.db) {
            console.log('Saving data...');
            endure.save(true);
        }
        console.log('Exiting...');
        process.exit();
    });
}

async function loadData() {
    await endure.load(`${__dirname}/../data`, '{"user": {}, "site": {}}');
    site.init(endure);
    user.init(endure);

    ASSET.favicon = await fs.readFile(`${__dirname}/inc/favicon.png`);
    ASSET.mainCss = await fs.readFile(`${__dirname}/inc/main.css`, 'utf8');
    ASSET.ajaxTool = await fs.readFile(`${__dirname}/ajax-tool.html`, 'utf8');

    // TEMPLATE.home = await readFile(`${__dirname}/index.html.mustache`, 'utf8');
    TEMPLATE.delete = await fs.readFile(`${__dirname}/inc/delete.html.mustache`, 'utf8');
}

function startHTTP() {
    http.createServer(collectReqBody).listen(process.env.PORT, function () {
        console.log(`Server started on http://0.0.0.0:${process.env.PORT}${process.env.SUBDIR}`);
    });
}

init();
loadData().then(startHTTP);
