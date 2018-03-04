class QuickSearch {
    constructor(options) {
        this.inputSelector = options.inputSelector;
        this.findSelector = options.findSelector;
        this.input = options.input;
        this._inputEvent();
    }

    _searchText(text) {
        const inputText = text.trim();
        let findCount = 0;
        const findElements = document.querySelectorAll(this.findSelector);
        findElements.forEach(item => {
            const plainText = item.textContent;
            if (plainText.includes(inputText)) {
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

        inputElement.addEventListener('compositionstart', () => {
            cpLock = true;
        });

        inputElement.addEventListener('compositionend', e => {
            cpLock = false;
            this._searchText(e.target.value);
        });

        inputElement.addEventListener('input', e => {
            if (!cpLock) {
                this._searchText(e.target.value);
            }
        });
    }

    /**
     * trigger search event
     * after searched, if modified route data, the search result will error, so must trigger manually
     * 
     * @memberof QuickSearch
     */
    triggerSearch() {
        this._searchText(document.querySelector(this.inputSelector).value);
    }
}
