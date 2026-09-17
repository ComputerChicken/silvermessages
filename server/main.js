const express = require('express');
const argon2 = require('argon2');
const cors = require('cors');
const fs = require("fs/promises");

const app = express();
const PORT = 17356;

// Middleware to parse incoming JSON bodies
app.use(express.json());
app.use(express.text());
app.use(cors());

async function fetchUserData(username) {
    try {
        const data = await fs.readFile("users.json", 'utf8');
        const dataJSON = JSON.parse(data);
        return dataJSON[username]
    } catch (error) {
        console.log("Error: " + error)
        return null;
    }
}

async function fetchAllUsernames() {
    try {
        const data = await fs.readFile("users.json", 'utf8');
        const dataJSON = JSON.parse(data);
        return Object.keys(dataJSON);
    } catch (error) {
        console.log("Error: " + error)
        return null;
    }
}

async function fetchAllUsers() {
    try {
        const data = await fs.readFile("users.json", 'utf8');
        const dataJSON = JSON.parse(data);

        return dataJSON;
    } catch (error) {
        console.log("Error: " + error)
        return null;
    }
}

async function register(name, username, password) {
    try {
        const data = await fs.readFile("users.json", 'utf8');
        const dataJSON = JSON.parse(data);
        const hashedPassword = await argon2.hash(password);
        var hashedUID = await argon2.hash(username, {raw:true});
        hashedUID = hashedUID.toString('hex');
        dataJSON[username] = {
            hash: hashedPassword,
            uid: hashedUID,
            name: name
        }
        await fs.writeFile("users.json", JSON.stringify(dataJSON, null, 2), 'utf8');
        return hashedUID;
    } catch (error) {
        console.log("Error: " + error)
        return null;
    }
}

async function getChats(UID) {
    try {
        const files = await fs.readdir("./");
        
        const matchedFiles = files.filter(file => file.includes(UID));

        var chats = [];

        for(const file of matchedFiles) {
            const data = await fs.readFile(file, 'utf8');
            const dataJSON = JSON.parse(data);
            chats.push({chatID: file, users: dataJSON.users});
        }

        return chats;
    } catch (error) {
        console.error('Error reading directory:', error);
        return null;
    }
}

async function startChat(UIDs) {
    var users = []
    for(const uid of UIDs) {
        users.push(await getUserFromUid(uid));
    }
    await fs.writeFile(UIDs.join('')+".json", JSON.stringify({
        users: users,
        chats: []
    }, null ,2), 'utf8');
}

async function sendChat(chat, user, message) {
    const data = await fs.readFile(chat, 'utf8');
    const dataJSON = JSON.parse(data);
    dataJSON.chats.push(user+": "+message);
    await fs.writeFile(chat, JSON.stringify(dataJSON, null, 2), 'utf8');
    return;
}

async function getUserFromUid(uid) {
    const data = await fetchAllUsers();
    for(const user of Object.keys(data)) {
        if(data[user].uid == uid) {
            return user;
        }
    }
    return null;
}

// POST for loginning in and providing UID
app.post('/login', async (req, res) => {
    const data = req.body;
    const userData = await fetchUserData(data.username)
    if(userData != null) {
        const isMatch = await argon2.verify(userData.hash, data.password);
        if(isMatch) {
            res.status(200).send(userData.uid);
        } else {
            res.status(403).send("Incorrect password or username");
        }
    } else {
        res.status(403).send("Incorrect password or username");
    }
});

// POST for registering providing UID
app.post('/register', async (req, res) => {
    const data = req.body;
    if(data.username == "" || data.password == "" || data.name == "") {
        res.status(400).send("Invalid username or password")
        return;
    }
    const usernames = await fetchAllUsernames();
    if(!usernames.includes(data.username)) {
        const UID = await register(data.name, data.username, data.password);
        res.status(201).send(UID);
    } else {
        res.status(400).send("Username taken");
    }
});

// POST route to send message
app.post('/send', async (req, res) => {
    const data = req.body;
    const user = await getUserFromUid(data.uid);
    sendChat(data.chat, user, data.message);
    res.status(201).send("ya");
});

// POST route for retrieving chats
app.post('/get-chats', async (req, res) => {
    const data = req.body;
    res.status(200).json(await getChats(data.uid));
});

// GET route for searching people
app.post('/search-people', async (req, res) => {
    const data = req.body;
    const users = await fetchAllUsers();
    const matches = {};
    for(const user of Object.keys(users)) {
        if(users[user].name.toLowerCase().includes(data.search.toLowerCase())) {
            matches[user] = users[user]
        }
    }
    res.status(200).json(matches);
});

app.post('/create-chat', async (req, res) => {
    const data = req.body;
    const uids = [data.uid];
    for(const user of data.users) {
        const userData = await fetchUserData(user);
        uids.push(userData.uid);
    }
    startChat(uids);
    res.status(201).send("ya it worked");
});

app.post('/fetch-chat', async (req, res) => {
    const data = req.body;
    const chatData = await fs.readFile(data.id, 'utf8');
    const dataJSON = JSON.parse(chatData);
    res.status(200).json(dataJSON);
});

app.listen(PORT, () => {
    console.log(`Server running at http://161.97.222.175:${PORT}`);
});