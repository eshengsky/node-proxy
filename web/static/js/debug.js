(function () {
    const Tool = eruda.Tool;
    const util = eruda.util;
    const ServerLog = Tool.extend({
        name: '后端日志',
        init: function ($el) {
            const data = document.querySelector('#server-log-data');
            let logs = '无后端日志';
            if (data) {
                logs = data.innerHTML;
            }
            this.callSuper(Tool, 'init', arguments);
            this._style = util.evalCss(`
            .eruda-container * {
                -webkit-user-select: auto;
                -moz-user-select: auto;
                -ms-user-select: auto;
                user-select: auto;
            }

            .eruda-后端日志 {
                height: auto !important;
            }

            .server-log-warn {
                z-index: 40;
                background: #fffbe6;
                border-top: 1px solid #ffc107 !important;
                border-bottom: 1px solid #ffc107 !important;
                padding: 10px !important;
            }

            .server-log-warn .eruda-icon-container {
                float: left;
                margin-right: 5px;
            }

            .server-log-warn .eruda-icon {
                color: #ff6f00;
                line-height: 20px;
                font-size: 12px;
            }

            .server-log-warn p {
                margin-left: 17px;
            }

            .server-log-list {
                color: #444;
                list-style: none;
                -webkit-padding-start: 0;
                overflow-y: auto;
                height: 100%;
                margin-left: 1px !important;
            }

            .server-log-list:empty:before {
                content: "无服务端日志";
                color: #888;
                display: block;
                text-align: center;
                margin-top: 50px;
            }
            
            .server-log-list li {
                padding: 5px;
                margin: 3px 0;
                overflow: hidden;
                white-space: pre-wrap;
                word-wrap: break-word;
                line-height: 20px;
                word-break: break-all;
                position: relative;
            }
            
            .server-log-list li:hover {
                background: #f6f6f6;
                border-left-width: 5px;
            }
            
            .server-log-list li a {
                color: #444;
                display: inline-block;
                text-decoration: underline;
            }
            
            .server-log-list li a:active, .server-log-list li a:focus, .server-log-list li a:hover, .server-log-list li a:hover {
                color: #444;
            }
            
            .server-log-list li.info {
                border-left: 3px solid #1296db;
            }
            
            .server-log-list .time, .server-log-list .type, .server-log-list .category, .server-log-list .split {
                color: #1296db;
            }
            
            .server-log-list li.warn {
                border-left: 3px solid #f80;
            }
            
            .server-log-list li.warn .time, .server-log-list li.warn .type, .server-log-list li.warn .category, .server-log-list li.warn .split {
                color: #f80;
            }
            
            .server-log-list li.error {
                border-left: 3px solid orangered;
            }
            
            .server-log-list li.error .time, .server-log-list li.error .type, .server-log-list li.error .category, .server-log-list li.error .split {
                color: orangered;
                font-weight: bold;
            }
            
            .gutter {
                background-color: #eee;
                background-repeat: no-repeat;
                background-position: 50%;
                background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAFAQMAAABo7865AAAABlBMVEVHcEzMzMzyAv2sAAAAAXRSTlMAQObYZgAAABBJREFUeF5jOAMEEAIEEFwAn3kMwcB6I2AAAAAASUVORK5CYII=');
                cursor: ns-resize;
            }
            `);
            $el.html(logs);
        },
        show: function () {
            this.callSuper(Tool, 'show', arguments);
        },
        hide: function () {
            this.callSuper(Tool, 'hide', arguments);
        },
        destroy: function () {
            this.callSuper(Tool, 'destroy', arguments);
            util.evalCss.remove(this._style);
        }
    });
    eruda.init();
    eruda.add(new ServerLog());
    const cs = eruda.get('console');
    cs.config.set('catchGlobalErr', true);
    // cs.config.set('overrideConsole', true);
    cs.config.set('displayExtraInfo', true);
    cs.config.set('displayUnenumerable', true);
    cs.config.set('displayGetterVal', true);
    cs.config.set('viewLogInSources', false);
    cs.config.set('displayIfErr', false);
    cs.config.set('useWorker', false);
    const sr = eruda.get('sources');
    sr.config.set('formatCode', false);
}());
