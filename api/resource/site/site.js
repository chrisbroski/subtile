const fs = require('fs').promises;

// Custom libs
const main = require('../../inc/main.js');

const resourceName = 'site';
const template = {};
var endure;

function single(msg, error) {
    var siteData = endure.db[resourceName] || {};
    var headerFontNormal = ' checked="checked"';
    var headerFontBold = '';
    if (siteData["header-font-weight"] === "bold") {
        headerFontNormal = '';
        headerFontBold = ' checked="checked"';
    }
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": main.toTitleCase(resourceName),
        "header-font-normal": headerFontNormal,
        "header-sans-serif-selected": siteData["header-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "header-serif-selected": siteData["header-font-default"] === "serif" ? ' selected="selected"' : '',
        "header-monospace-selected": siteData["header-font-default"] === "monospace" ? ' selected="selected"' : '',
        "header-cursive-selected": siteData["header-font-default"] === "cursive" ? ' selected="selected"' : '',
        "header-fantasy-selected": siteData["header-font-default"] === "fantasy" ? ' selected="selected"' : '',
        "header-font-bold": headerFontBold,
        "body-sans-serif-selected": siteData["body-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "body-serif-selected": siteData["body-font-default"] === "serif" ? ' selected="selected"' : '',
        "body-monospace-selected": siteData["body-font-default"] === "monospace" ? ' selected="selected"' : '',
        "body-cursive-selected": siteData["body-font-default"] === "cursive" ? ' selected="selected"' : '',
        "body-fantasy-selected": siteData["body-font-default"] === "fantasy" ? ' selected="selected"' : ''
    }, endure.db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function siteData(rsp) {
    var siteData = endure.db[resourceName] || {}
    main.returnJson(rsp, {
        "site": siteData
    });
}

function isSetupInvalid(body) {
    var msg = [];

    if (!body.name) {
        msg.push('Application name is required.');
    }
    if (!body.email) {
        msg.push('Email is required.');
    }
    if (!body.password) {
        msg.push('Password is required.');
    }
    if (body.password.length < 8) {
        msg.push('Password must be at least 8 characters.');
    }
    if (body.confirmPassword !== body.password) {
        msg.push("Passwords don't match.");
    }

    return msg;
}

function isUpdateInvalid(body) {
    var msg = [];

    if (!body.color1) {
        msg.push('Primary color is required.');
    }
    if (!body.color2) {
        msg.push('Secondary color is required.');
    }

    return msg;
}

function initialSetup(body) {
    if (!endure.db[resourceName]) {
        endure.db[resourceName] = {};
    }
    endure.db[resourceName].name = body.name;

    var salt = main.makeId(12);
    var hash = main.hash(body.password, salt);

    var id = main.makeId();
    endure.db.user[id] = {};

    endure.db.user[id].email = body.email;
    endure.db.user[id].salt = salt;
    endure.db.user[id].hash = hash;
    endure.db.user[id].token = '';
    endure.db.user[id].admin = true;
    endure.db.user[id].owner = true;

    endure.save();
}

function updateResource(body) {
    endure.db[resourceName].color1 = body.color1;
    endure.db[resourceName].color2 = body.color2;

    endure.db[resourceName]["header-font"] = body["header-font"];
    endure.db[resourceName]["header-font-weight"] = body["header-font-weight"];
    endure.db[resourceName]["header-font-default"] = body["header-font-default"];
    endure.db[resourceName]["body-font"] = body["body-font"];
    endure.db[resourceName]["body-font-default"] = body["body-font-default"];

    endure.db[resourceName].background = body.background;
    endure.db[resourceName].thumbnail = body.thumbnail;

    endure.save();
}

this.setup = function (req, rsp, formData) {
    var error = isSetupInvalid(formData);

    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.start, {
            "hasError": true,
            "error": error,
            "formData": formData
        }, endure.db));
        return;
    }

    initialSetup(formData);

    var returnData = main.responseData("", resourceName, endure.db, "Updated", ["Site setup complete."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(303, {'Content-Type': 'text/plain', "Location": `${process.env.SUBDIR}/login`});
    rsp.end("Site setup complete.");
};

this.update = function (req, rsp, formData) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single("", error), endure.db));
        return;
    }

    updateResource(formData);

    var returnData = main.responseData("", resourceName, endure.db, "Updated", ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single([`${resourceName} updated.`]), endure.db));
};

function getCustomCSS(site) {
    var color1 = main.hexToRgb(site.color1);
    var color2 = main.hexToRgb(site.color2);
    var headerFont = "";
    var bodyFont = "";
    var fontImport = "";
    var fontWeight = "normal";
    var fonts = [];

    if (site["header-font"]) {
        fonts.push(`family=${encodeURI(site["header-font"])}`);
        headerFont = `'${site["header-font"]}', ${site["header-font-default"]}`;
    } else {
        headerFont = `${site["header-font-default"]}`;
    }
    if (site["body-font"]) {
        fonts.push(`family=${encodeURI(site["body-font"])}`);
        bodyFont = `'${site["body-font"]}', ${site["body-font-default"]}`;
    } else {
        bodyFont = `${site["body-font-default"]}`;
    }

    if (fonts.length > 0) {
        fontImport = `@import url('https://fonts.googleapis.com/css2?${fonts.join("&")}&display=swap');

`;
    }
    if (site["header-font-weight"]) {
        fontWeight = site["header-font-weight"];
    }

    return `${fontImport}:root {
    --color1: ${color1.r}, ${color1.g}, ${color1.b};
    --color2: ${color2.r}, ${color2.g}, ${color2.b};
    --header-font: ${headerFont};
    --header-font-weight: ${fontWeight};
    --body-font: ${bodyFont};
}
`;
}

this.getCss = function (req, rsp, isCss) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'text/css' || isCss) {
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(getCustomCSS(endure.db.site));
        return;
    }
    return main.returnJson(rsp, endure.db[resourceName]);
};

this.start = function (req, rsp) {
    // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.start, {}, endure.db));
};

this.get = function (req, rsp) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return siteData(rsp, db);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single(), endure.db));
};

this.init = function (_endure) {
    endure = _endure;
};

async function loadData() {
    template.site = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.start = await fs.readFile(`${__dirname}/start.html.mustache`, 'utf8');
}

loadData();
