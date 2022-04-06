const main = require('../../inc/main.js');

const resourceName = 'user';
const template = {};
var endure;
var API_DIR;

function single(id, req, msg, error) {
    var authUserData = main.getAuthUserData(req, endure.db.user);
    var resourceData = endure.db[resourceName];
    var pageName = `${resourceData[id].givenName} ${resourceData[id].surname}`;
    if (pageName === " ") {
        pageName = resourceData[id].email;
    }

    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": pageName,
        "adminChecked": !!resourceData[id].admin ? ' checked="checked"' : '',
        "isOwnUser": (authUserData.userid === id),
        "countries": main.country(resourceData[id].country)
    }, resourceData[id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(msg, error, link) {
    var resourceData =  {
        [resourceName]: main.objToArray(endure.db[resourceName]).sort(main.sortByDateDesc),
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "countries": main.country(),
        "pageName": "Users"
    };

    resourceData[resourceName] = resourceData[resourceName].map(u => {
        u.userName = u.email;
        if (u.givenName || u.surname) {
            u.userName = `${u.givenName} ${u.surname}`;
        }
        return u;
    });

    return Object.assign(main.addMessages(msg, error, link), resourceData);
}

function singleData(id) {
    return Object.assign({"resourceName": resourceName}, resourceData[resourceName][id]);
}

function listData() {
    return main.objToArray(resourceData[resourceName]).sort(main.sortByDateDesc);
}

function checkEmailExists(email, users) {
    return Object.keys(users).some(function (id) {
        return users[id].email === email;
    });
}

// Form validation
function isCreateInvalid(formData) {
    var msg = [];

    if (!formData.email) {
        msg.push('Email is required.');
    }

    if (checkEmailExists(formData.email, endure.db.user)) {
        msg.push(`Email ${formData.email} already exists.`);
    }

    return msg;
}

function isUpdateInvalid(formData) {
    var msg = [];

    if (!formData.email) {
        msg.push('Email is required.');
    }

    return msg;
}

function updateResource(id, formData) {
    var resourceData = endure.db[resourceName];
    resourceData[id].email = formData.email;
    resourceData[id].givenName = formData.givenName;
    resourceData[id].surname = formData.surname;
    resourceData[id].admin = formData.admin;
    resourceData[id].desc = formData.desc;
    resourceData[id].bio = formData.bio;
    resourceData[id].city = formData.city;
    resourceData[id].state = formData.state;
    resourceData[id].country = formData.country;

    endure.save();
}

this.create = function (req, rsp, formData) {
    var error = isCreateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list()), endure.db, API_DIR));
        // ^ this needs selected values for country
        return;
    }

    var id = main.createResource(formData, endure.db, endure.save, resourceName, updateResource);

    db[resourceName][id].token = main.makeId(12);

    var returnData = main.responseData(id, resourceName, endure.db, "Created", API_DIR);

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, 201);
    }

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, Object.assign({
        "hasMsg": true,
        "link": {"text": `Created ${resourceName} id ${id}`, "href": `${API_DIR}/${resourceName}/${id}`}
    }, list()), endure.db, API_DIR));
};

this.update = function (req, rsp, id, formData) {
    if (!endure.db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, endure.db, API_DIR);
    }
    // validate more fields
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(id, req, "", error), db, API_DIR));
        return;
    }

    updateResource(id, formData);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, req, [`${resourceName} id ${id} updated.`]), db, API_DIR));
};

this.remove = function (req, rsp, id) {
    var name;
    if (!endure.db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, endure.db, API_DIR);
    }

    name = endure.db[resourceName][id].name;
    delete endure.db[resourceName][id];
    save();

    var returnData = main.responseData(id, resourceName, endure.db, "Deleted", API_DIR, [`${resourceName} '${name}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, endure.db, API_DIR));
};

this.get = function (req, rsp, id) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!endure.db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, endure.db, API_DIR);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(endure.db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(id, req), db, API_DIR));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData());
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(), db, API_DIR));
    }
};

this.init = function (_endure, _API_DIR) {
    endure = _endure;
    API_DIR = _API_DIR;
};

async function loadData() {
    template.single = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await main.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
