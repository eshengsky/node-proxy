// 编辑器单例
let editor;
require.config({ paths: { 'vs': '/node-proxy/static/monaco-editor/min/vs' }});
require.config({
    'vs/nls' : {
        availableLanguages: {
            '*': 'zh-cn'
        }
    }
});

// 初始化编辑器
function initEditor(text, mode) {
    require(['vs/editor/editor.main'], () => {
        if (!editor) {
            editor = monaco.editor.create(document.getElementById('text-body'), {
                model: null,
                fontSize: 14,
                automaticLayout: true,
                dragAndDrop: false,
                readOnly: true,
                theme: 'vs-dark'
            });
            $('#line-info').text(`行 1，列 1`);
            editor.onDidChangeCursorPosition(() => {
                let position = editor.getPosition();
                if (!position || !position.lineNumber) {
                    position = {
                        lineNumber: 1,
                        column: 1
                    }
                }
                $('#line-info').text(`行 ${position.lineNumber}，列 ${position.column}`);
            });
        } else {
            const newModel = monaco.editor.createModel(text, mode);
            editor.setModel(newModel);
        }
    });
}

initEditor();

let mode = 'plaintext';
const url = new URL(location.href);
const path = url.searchParams.get('path');
const matched = path.match(/\.[a-zA-Z]+$/);
if (matched && matched[0]) {
    const ext = matched[0];
    switch (ext) {
        case '.css':
            mode = 'css';
            break;
        case '.hbs':
            mode = 'handlebars';
            break;
        case '.htm':
        case '.html':
        case '.xml':
            mode = 'html';
            break;
        case '.js':
            mode = 'javascript';
            break;
        case '.json':
            mode = 'json';
            break;
        case '.markdown':
        case '.md':
            mode = 'markdown';
            break;
        case '.pug':
        case '.jade':
            mode = 'jade';
            break;
        case '.vue':
            mode = 'html';
            break;
        default:
            mode = 'plaintext';
    }
}
$('#select-mode').val(mode).change();

$.get('/node-proxy/getFileContent', {
    path
}).done(data => {
    initEditor(data, mode);
});

// 转到行
$('#line-info').on('click', () => {
    editor.getAction('editor.action.gotoLine').run();
});

// 切换主题
$('#select-theme').on('change', () => {
    const theme = $('#select-theme').val();
    monaco.editor.setTheme(theme);
    if (theme === 'vs') {
        $('.file-name').addClass('light');
    } else {
        $('.file-name').removeClass('light');
    }
});

// 切换语言模式
$('#select-mode').on('change', () => {
    const text = editor.getValue();
    const mode = $('#select-mode').val();
    initEditor(text, mode);
});