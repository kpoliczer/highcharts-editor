/******************************************************************************

Copyright (c) 2016, Highsoft

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

******************************************************************************/

(function () {
    var webImports = {
        CSV: {
            description: '',
            treatAs: 'csv',
            filter: function (data, options, fn) {
                fn(false, data);
            }
        },
        Socrata: {
            description: 'Socrata is an open data format commonly used for various government sources. <a href="http://www.opendatanetwork.com/" target="_blank">http://www.opendatanetwork.com/</a>',
            treatAs: 'csv',
            fetchAs: 'json',
            defaultURL: 'https://finances.worldbank.org/resource/czdd-amke.json',
            options: {
                includeFields: {
                    type: 'string',
                    label: 'Fields to include, separate by whitespace',
                    default: 'fiscal_year amount_us_millions_'                        
                }
            },
            filter: function (data, options, fn) {
                var csv = [], header = [];

                options.includeFields = highed.arrToObj(options.includeFields.split(' '));

                if (highed.isArr(data)) {

                    //Only include things we're interested in
                    data = data.map(function (d) {
                        var r = {};
                        Object.keys(options.includeFields).forEach(function (c) {
                            r[c] = d[c];
                        });
                        return r;
                    });

                    data.forEach(function (row, i) {
                        var rdata = [];                            
                        
                        Object.keys(row).forEach(function (key) {
                            var col = row[key];

                            if (!options.includeFields[key]) {
                                return;
                            }

                            if (i == 0) {
                                header.push(key);
                            }

                            rdata.push(col);
                            
                        });
                        csv.push(rdata.join(','));
                    });
                }

                fn(false, [header.join(',')].concat(csv).join('\n'));
            }
        }
    };

    highed.importPlugins = {
        /* Install a data import plugin */
        install: function (name, defintion) {
            if (highed.isNull(webImports[name])) {
                webImports[name] = highed.merge({
                    description: '',
                    treatAs: 'csv',
                    fetchAs: 'json',
                    defaultURL: '',
                    options: {},
                    filter: function (){}
                }, defintion);
            } else {
                highed.log(1, 'tried to register an import plugin which already exists:', name);
            }
        }
    };

    /* Data importer widget
     * @parent - the node to attach the widget to
     *
     * @returns an instance of DataImporter
     */
    highed.DataImporter = function (parent) {
        var events = highed.events(),

            tabs = highed.TabControl(parent),
            csvTab = tabs.createTab({title: 'CSV'}),
            jsonTab = tabs.createTab({title: 'JSON'}),
            webTab = tabs.createTab({title: 'Web'}),
            samplesTab = tabs.createTab({title: 'Sample Data'}),

            csvPasteArea = highed.dom.cr('textarea', 'highed-imp-pastearea'),
            csvImportBtn = highed.dom.cr('button', 'highed-imp-button', 'Import'),
            csvImportFileBtn = highed.dom.cr('button', 'highed-imp-button', 'Upload & Import File'),
            delimiter = highed.dom.cr('input', 'highed-imp-input'),
            dateFormat = highed.dom.cr('input', 'highed-imp-input'),
            decimalPoint = highed.dom.cr('input', 'highed-imp-input'),
            firstAsNames = highed.dom.cr('input', 'highed-imp-input'),

            jsonPasteArea = highed.dom.cr('textarea', 'highed-imp-pastearea'),
            jsonImportBtn = highed.dom.cr('button', 'highed-imp-button', 'Import'),
            jsonImportFileBtn = highed.dom.cr('button', 'highed-imp-button', 'Upload & Import File'),

            webSplitter = highed.HSplitter(webTab.body, {leftWidth: 30}),
            webList = highed.List(webSplitter.left)            
        ;

        jsonPasteArea.value = JSON.stringify({}, undefined, 2);

        ///////////////////////////////////////////////////////////////////////////

        highed.dom.style(samplesTab.body, {overflow: 'hidden'});

        function buildWebTab() {
            Object.keys(webImports).forEach(function (name) {

                function buildBody() {            
                    var options = webImports[name],
                        url = highed.dom.cr('input', 'highed-imp-input-stretch'),
                        importBtn = highed.dom.cr('button', 'highed-imp-button', 'Import ' + name + ' from URL'),
                        dynamicOptionsContainer = highed.dom.cr('table', 'highed-customizer-table'),
                        dynamicOptions = {};
                    ;

                    url.value = options.defaultURL || '';

                    Object.keys(options.options || {}).forEach(function (name) {
                        dynamicOptions[name] = options.options[name].default;

                        highed.dom.ap(dynamicOptionsContainer,
                            highed.InspectorField(options.options[name].type, options.options[name].default, {title: options.options[name].label}, function (nval) {
                                dynamicOptions[name] = nval;
                            }, true)
                        );
                    });

                    url.placeholder = 'Enter URL';

                    highed.dom.on(importBtn, 'click', function () {
                        highed.snackBar('Importing data');

                        highed.ajax({
                            url: url.value,
                            type: 'get',
                            dataType: options.fetchAs || 'text',
                            success: function (val) {
                                options.filter(val, highed.merge({}, dynamicOptions), function (error, val) {       
                                    if (error) return highed.snackBar('import error: ' + error);                         
                                    if (options.treatAs === 'csv') {
                                        csvTab.focus();
                                        csvPasteArea.value = val;
                                        emitCSVImport(val);
                                    } else {
                                        processJSONImport(val);
                                    }
                                });
                            },
                            error: function (err) {
                                highed.snackBar('import error: ' + err);
                            }
                        });
                    });

                    webSplitter.right.innerHTML = '';

                    highed.dom.ap(webSplitter.right,
                     //   highed.dom.cr('div', 'highed-customizer-table-heading', name),
                        highed.dom.cr('div', 'highed-imp-help', options.description),
                        highed.dom.cr('div', '', 'URL'),
                        url,
                        Object.keys(options.options || {}).length ? dynamicOptionsContainer : false,
                        highed.dom.cr('br'),
                        importBtn
                    );
                }

                webList.addItem({
                    id: name,
                    title: name,
                    click: buildBody
                });

            });

            webList.selectFirst();
        }

        function buildSampleTab() {
            samplesTab.innerHTML = '';

            if (!highed.isNull(highed.meta.sampleData)) {
                Object.keys(highed.meta.sampleData).forEach(function (name) {
                    var data = highed.meta.sampleData[name].join('\n'),

                        loadBtn = highed.dom.cr('button', 'highed-box-size highed-imp-button', name)
                    ;

                    highed.dom.style(loadBtn, {width: '99%'});

                    highed.dom.on(loadBtn, 'click', function () {
                        emitCSVImport(data);
                        csvPasteArea.value = data;
                        csvTab.focus();
                    });

                    highed.dom.ap(samplesTab.body, 
                        //highed.dom.cr('div', '', name),
                        //highed.dom.cr('br'),
                        loadBtn, 
                        highed.dom.cr('br')
                    );
                });
            }
        }

        function emitCSVImport(csv) {
            events.emit('ImportCSV', {
                itemDelimiter: delimiter.value,
                firstRowAsNames: firstAsNames.checked,
                dateFormat: dateFormat.value,
                csv: csv || csvPasteArea.value,
                decimalPoint: decimalPoint.value
            });
        }

        function processJSONImport(jsonString) {
            var json = jsonString;
            if (highed.isString(json)) {            
                try {
                    json = JSON.parse(jsonString);
                } catch(e) {
                    highed.snackBar('Error parsing json: ' + e);
                    return false;
                }
            }
            events.emit('ImportJSON', json);
            highed.snackBar('imported json');
        }
        
        function resize(w, h) {
            var bsize;

            tabs.resize(w, h);
            bsize = tabs.barSize();
            
            webSplitter.resize(w, h - bsize.h - 20);
            webList.resize(w, h - bsize.h);
        }

        ///////////////////////////////////////////////////////////////////////////

        highed.dom.ap(csvTab.body, 
            highed.dom.cr('div', 'highed-imp-help', 'Paste CSV into the below box, or upload a file. Click Import to import your data.'),
            csvPasteArea,

            highed.dom.cr('span', 'highed-imp-label', 'Delimiter'),
            delimiter,
            highed.dom.cr('br'),

            highed.dom.cr('span', 'highed-imp-label', 'Date Format'),
            dateFormat,
            highed.dom.cr('br'),

            highed.dom.cr('span', 'highed-imp-label', 'Decimal Point Notation'),
            decimalPoint,
            highed.dom.cr('br'),

            highed.dom.cr('span', 'highed-imp-label', 'First Row Is Series Names'),
            firstAsNames,
            highed.dom.cr('br'),
            
            csvImportFileBtn,
            csvImportBtn
        );

        highed.dom.ap(jsonTab.body, 
            highed.dom.cr('div', 'highed-imp-help', 'Paste JSON into the below box, or upload a file. Click Import to import your data.'),
            jsonPasteArea,
            jsonImportFileBtn,
            jsonImportBtn
        );

        highed.dom.on(csvImportBtn, 'click', emitCSVImport);

        highed.dom.on(csvPasteArea, 'keyup', function (e) {
            if (e.keyCode === 13) {
                emitCSVImport();
            }
        });

        highed.dom.on(csvImportFileBtn, 'click', function () {
            highed.readLocalFile({
                type: 'text',
                accept: '.csv',
                success: function (info) {
                    csvPasteArea.value = info.data;
                    highed.snackBar('File uploaded');
                    emitCSVImport();
                }
            });
        });

        highed.dom.on(jsonImportBtn, 'click', function () {
            processJSONImport(jsonPasteArea.value);
        });

        highed.dom.on(jsonImportFileBtn, 'click', function () {
            highed.readLocalFile({
                type: 'text',
                accept: '.json',
                success: function (info) {
                    jsonPasteArea.value = info.data;
                    processJSONImport(info.data);
                }
            });
        });

        buildSampleTab();
        buildWebTab();

        delimiter.value = ',';
        //dateFormat.value = 'YYYY-mm-dd';
        firstAsNames.type = 'checkbox';
        decimalPoint.value = '.';
        firstAsNames.checked = true;

        resize();

        ///////////////////////////////////////////////////////////////////////////
        
        return {
            on: events.on,
            resize: resize
        };
    };
})();