/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-11 13:48:27 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-05-21 14:23:37
 */
class QuickSearch {
    constructor(options) {
        this.inputSelector = options.inputSelector;
        this.findSelector = options.findSelector;
        this.input = options.input;
        this._inputEvent();
    }

    _searchText(text) {
        // 去除前后空格
        const inputText = text.trim();
        let findCount = 0;
        const findElements = document.querySelectorAll(this.findSelector);
        findElements.forEach(item => {
            // 注意：使用innerText是获取不到隐藏内容的
            const plainText = item.textContent;
            if (plainText.toUpperCase().indexOf(inputText.toUpperCase()) >= 0) {
                item.style.display = 'table-row';
                setTimeout(() => {
                    item.style.opacity = 1;
                }, 0);
                findCount++;
            } else {
                item.style.opacity = 0;
                setTimeout(() => {
                    item.style.display = 'none';
                }, 0);
            }
        });

        if (typeof this.input === 'function') {
            this.input({
                text: inputText,
                find: findCount
            });
        }
    }

    _inputEvent() {
        const inputElement = document.querySelector(this.inputSelector);
        let cpLock = false;

        // 开始敲中文
        inputElement.addEventListener('compositionstart', () => {
            cpLock = true;
        });

        // 中文输入完成了
        inputElement.addEventListener('compositionend', e => {
            cpLock = false;
            this._searchText(e.target.value);
        });

        // 非中文字输入
        inputElement.addEventListener('input', e => {
            if (!cpLock) {
                this._searchText(e.target.value);
            }
        });
    }

    /**
     * 触发一次搜索
     * 场景：搜索后，修改了路由等数据，会导致搜索列表不正确，故需要手动再触发一次
     * 
     * @memberof QuickSearch
     */
    triggerSearch() {
        this._searchText(document.querySelector(this.inputSelector).value);
    }
}
