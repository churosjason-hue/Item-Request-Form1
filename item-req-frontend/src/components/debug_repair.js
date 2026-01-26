const fs = require('fs');
const path = 'c:\\Users\\deane\\OneDrive\\Desktop\\Item-Request-Form1\\item-req-frontend\\src\\components\\RequestForm.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

lines.forEach((line, index) => {
    if (line.includes('Attachments Section - Hidden')) {
        console.log(`Line ${index + 1}: [${line}]`);
    }
});
