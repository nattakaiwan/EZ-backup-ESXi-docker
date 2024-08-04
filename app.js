const express = require('express');
const bodyParser = require('body-parser');
const { NodeSSH } = require('node-ssh');

const app = express();
const ssh = new NodeSSH();

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>EZ Backup ESXi</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                form {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-top: 10px;
                }
                input {
                    width: 50%;
                    padding: 8px;
                    margin-top: 5px;
                }
                button {
                    margin-top: 10px;
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                pre {
                    background-color: #f4f4f4;
                    padding: 10px;
                    border: 1px solid #ddd;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .stdout {
                    color: green;
                }
                .stderr {
                    color: red;
                }
                .download-link {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 10px 20px;
                    background-color: #007BFF;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .download-link:hover {
                    background-color: #0056b3;
                }
                .progress-bar {
                    width: 100%;
                    background-color: #f3f3f3;
                    border: 1px solid #ddd;
                    margin-top: 20px;
                }
                .progress-bar-fill {
                    height: 24px;
                    width: 0;
                    background-color: #4CAF50;
                    text-align: center;
                    line-height: 24px;
                    color: white;
                }
                .credit {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    font-size: 12px;
                    color: #888;
                }
            </style>
        </head>
        <body>
            <h1>EZ Backup ESXi</h1>
            <form id="sshForm">
                <label for="ip">IP Address:</label>
                <input type="text" id="ip" name="ip" required><br><br>
                <label for="user">Username:</label>
                <input type="text" id="user" name="user" required><br><br>
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required><br><br>
                <button type="submit">Download Backup</button>
            </form>
            <div class="progress-bar">
                <div class="progress-bar-fill" id="progressBarFill">0%</div>
            </div>
            <pre id="output"></pre>
            <div class="credit">Created by Nattakaiwan S.</div>

            <script>
                document.getElementById('sshForm').addEventListener('submit', async function(event) {
                    event.preventDefault();
                    const ip = document.getElementById('ip').value;
                    const user = document.getElementById('user').value;
                    const password = document.getElementById('password').value;

                    const progressBarFill = document.getElementById('progressBarFill');
                    const updateProgressBar = (percentage) => {
                        progressBarFill.style.width = percentage + '%';
                        progressBarFill.textContent = percentage + '%';
                    };

                    updateProgressBar(0);

                    // Clear previous output
                    document.getElementById('output').innerHTML = '';

                    const response = await fetch('/execute', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ ip, user, password })
                    });

                    const result = await response.text();
                    document.getElementById('output').innerHTML = result;
                    updateProgressBar(100);
                });
            </script>
        </body>
        </html>
    `);
});

app.post('/execute', async (req, res) => {
    const { ip, user, password } = req.body;

    try {
        await ssh.connect({
            host: ip,
            username: user,
            password: password,
            tryKeyboard: true,
            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                finish([password]);
            }
        });

        const commands = [
            'vim-cmd hostsvc/firmware/sync_config',
            'vim-cmd hostsvc/firmware/backup_config'
        ];
        let output = '';
        const totalCommands = commands.length;

        for (let i = 0; i < totalCommands; i++) {
            const command = commands[i];
            const result = await ssh.execCommand(command);
            if (i === totalCommands - 1) {
                let stdout = result.stdout.replace('*', ip);
                output += `<div class="stdout">${stdout}</div>`;
                const urlMatch = stdout.match(/http:\/\/[^\s]+/);
                if (urlMatch) {
                    const downloadUrl = urlMatch[0];
                    const downloadLink = `<a href="${downloadUrl}" class="download-link">Download Output</a>`;
                    output += downloadLink;
                }
            }
            const progress = Math.round(((i + 1) / totalCommands) * 100);
            res.write(`<script>document.getElementById('progressBarFill').style.width = '${progress}%'; document.getElementById('progressBarFill').textContent = '${progress}%';</script>`);
        }

        res.write(output);
        res.end();
    } catch (error) {
        console.error('SSH Connection Error:', error);
        res.status(500).send('SSH Connection Error: ' + error.message);
    } finally {
        ssh.dispose();
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
