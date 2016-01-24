/*
 Trivial Components (https://github.com/trivial-components/trivial-components)

 Copyright 2015 Yann Massard (https://github.com/yamass) and other contributors

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
(function (factory) {
        "use strict";

        if (typeof define === 'function' && define.amd) {
            // Define as an AMD module if possible
            define('trivial-treecombobox', ['trivial-core', 'jquery', 'mustache'], factory);
        } else if (typeof exports === 'object') {
            // Node/CommonJS
            module.exports = factory(require('trivial-core'), require('jquery'), require('mustache'));
        } else if (jQuery && !jQuery.fn.trivialtreecombobox) {
            // Define using browser globals otherwise
            // Prevent multiple instantiations if the script is loaded twice
            factory(TrivialComponents, jQuery, Mustache);
        }
    }(function (TrivialComponents, $, Mustache) {

        var keyCodes = TrivialComponents.keyCodes;

        function TrivialTreeComboBox(originalInput, options) {
            var me = this;

            options = options || {};
            var _selectedEntryTemplate = (options.templates && options.templates.length > 0 && options.templates[0]) || TrivialComponents.icon2LinesTemplate;
            var config = $.extend({
                valueProperty: 'id',
                inputTextProperty: 'displayValue',
                templates: [TrivialComponents.iconSingleLineTemplate],
                selectedEntryTemplate: _selectedEntryTemplate,
                selectedEntry: null,
                spinnerTemplate: TrivialComponents.defaultSpinnerTemplate,
                noEntriesTemplate: TrivialComponents.defaultNoEntriesTemplate,
                textHighlightingEntryLimit: 100,
                entries: null,
                emptyEntryTemplate: options.emptyEntryTemplate || _selectedEntryTemplate,
                emptyEntry: {},
                queryFunction: null, // defined below...
                autoComplete: true,
                autoCompleteDelay: 0,
                allowFreeText: false,
                freeTextEntryValues: {_isFreeTextEntry: true},
                showTrigger: true,
                matchingOptions: {
                    matchingMode: 'contains',
                    ignoreCase: true,
                    maxLevenshteinDistance: 2
                },
                childrenProperty: "children",
                lazyChildrenFlagProperty: "hasLazyChildren",
                expandedProperty: 'expanded',
                editingMode: "editable" // one of 'editable', 'disabled' and 'readonly'
            }, options);

            config.queryFunction = config.queryFunction || TrivialComponents.defaultTreeQueryFunctionFactory(config.entries || [], config.templates, config.matchingOptions, config.childrenProperty, config.expandedProperty);

            this.onSelectedEntryChanged = new TrivialComponents.Event();

            var treeBox;
            var isDropDownOpen = false;
            var isEditorVisible = false;
            var lastQueryString = null;
            var lastCompleteInputQueryString = null;
            var entries = config.entries;
            var selectedEntry = null;
            var lastCommittedValue = null;
            var blurCausedByClickInsideComponent = false;
            var autoCompleteTimeoutId = -1;
            var doNoAutoCompleteBecauseBackspaceWasPressed = false;

            var $spinners = $();
            var $originalInput = $(originalInput);
            var $treeComboBox = $('<div class="tr-treecombobox tr-combobox tr-input-wrapper"/>')
                .addClass(config.editingMode)
                .insertAfter($originalInput);
            var $selectedEntryWrapper = $('<div class="tr-combobox-selected-entry-wrapper"/>').appendTo($treeComboBox);
            if (config.showTrigger) {
                var $trigger = $('<div class="tr-trigger"><span class="tr-trigger-icon"/></div>').appendTo($treeComboBox);
                $trigger.mousedown(function () {
                    if (isDropDownOpen) {
                        showEditor();
                        closeDropDown();
                    } else {
                        setTimeout(function () { // TODO remove this when Chrome bug is fixed. Chrome scrolls to the top of the page if we do this synchronously. Maybe this has something to do with https://code.google.com/p/chromium/issues/detail?id=342307 .
                            showEditor();
                            $editor.select();
                            openDropDown();
                            if (entries == null) {
                                query();
                            }
                        });
                    }
                });
            }
            var $dropDown = $('<div class="tr-dropdown"></div>')
                .scroll(function (e) {
                    return false;
                });
            var dropdownNeeded = config.editingMode == 'editable' && (config.entries && config.entries.length > 0 || options.queryFunction || config.showTrigger);
            if (dropdownNeeded) {
                $dropDown.appendTo("body");
            }
            var $editor;
            $originalInput.addClass("tr-original-input");
            $editor = $('<input type="text" autocomplete="off"/>');

            $editor.prependTo($treeComboBox).addClass("tr-combobox-editor tr-editor")
                .focus(function () {
                    if (blurCausedByClickInsideComponent) {
                        // do nothing!
                    } else {
                        $treeComboBox.addClass('focus');
                        showEditor();
                    }
                })
                .blur(function () {
                    if (blurCausedByClickInsideComponent) {
                        $editor.focus();
                    } else {
                        $treeComboBox.removeClass('focus');
                        if (editorContainsFreeText()) {
                            if (!TrivialComponents.objectEquals(me.getSelectedEntry(), lastCommittedValue)) {
                                selectEntry(me.getSelectedEntry(), true);
                            }
                        } else {
                            $editor.val("");
                            selectEntry(lastCommittedValue);
                        }
                        hideEditor();
                        closeDropDown();
                    }
                })
                .keydown(function (e) {
                    if (TrivialComponents.isModifierKey(e)) {
                        return;
                    } else if (e.which == keyCodes.tab) {
                        var highlightedEntry = treeBox.getHighlightedEntry();
                        if (isDropDownOpen && highlightedEntry) {
                            selectEntry(highlightedEntry, true);
                        }
                        return;
                    } else if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                        if (isDropDownOpen) {
                            // expand the currently highlighted node.
                            var changedExpandedState = treeBox.setHighlightedNodeExpanded(e.which == keyCodes.right_arrow);
                            if (changedExpandedState) {
                                return false;
                            }
                        }
                        showEditor();
                        return; // let the user navigate freely left and right...
                    }

                    if (e.which == keyCodes.backspace || e.which == keyCodes.delete) {
                        doNoAutoCompleteBecauseBackspaceWasPressed = true; // we want query results, but no autocomplete
                    }

                    if (e.which == keyCodes.up_arrow || e.which == keyCodes.down_arrow) {
                        if (!isEditorVisible) {
                            $editor.select();
                            showEditor();
                        }
                        var direction = e.which == keyCodes.up_arrow ? -1 : 1;
                        if (!isDropDownOpen) {
                            query(direction);
                            openDropDown();
                        } else {
                            treeBox.highlightNextEntry(direction);
                            autoCompleteIfPossible(config.autoCompleteDelay);
                        }
                        return false; // some browsers move the caret to the beginning on up key
                    } else if (isDropDownOpen && e.which == keyCodes.enter) {
                        if (isDropDownOpen || editorContainsFreeText()) {
                            e.preventDefault(); // do not submit form
                            var highlightedEntry = treeBox.getHighlightedEntry();
                            if (isDropDownOpen && highlightedEntry) {
                                selectEntry(highlightedEntry, true);
                            } else if (config.allowFreeText) {
                                selectEntry(me.getSelectedEntry(), true);
                            }
                            closeDropDown();
                            hideEditor();
                        }
                    } else if (e.which == keyCodes.escape) {
                        e.preventDefault(); // prevent ie from doing its text field magic...
                        if (!(editorContainsFreeText() && isDropDownOpen)) { // TODO if list is empty, still reset, even if there is freetext.
                            hideEditor();
                            $editor.val("");
                            entries = null; // so we will query again when we combobox is re-focused
                            selectEntry(lastCommittedValue, false);
                        }
                        closeDropDown();
                    } else {
                        if (!isEditorVisible) {
                            showEditor();
                            $editor.select();
                        }
                        openDropDown();
                        query(1);
                    }
                })
                .keyup(function (e) {
                    if (!TrivialComponents.isModifierKey(e) && e.which != keyCodes.enter && isEntrySelected() && $editor.val() !== selectedEntry[config.inputTextProperty]) {
                        selectEntry(null, false);
                    }
                })
                .mousedown(function () {
                    openDropDown();
                    if (entries == null) {
                        query();
                    }
                });

            if ($originalInput.attr("tabindex")) {
                $editor.attr("tabindex", $originalInput.attr("tabindex"));
            }
            if ($originalInput.attr("autofocus")) {
                $editor.focus();
            }

            $treeComboBox.add($dropDown).mousedown(function () {
                if ($editor.is(":focus")) {
                    blurCausedByClickInsideComponent = true;
                }
            }).mouseup(function () {
                if (blurCausedByClickInsideComponent) {
                    $editor.focus();
                    blurCausedByClickInsideComponent = false;
                }
            }).mouseout(function () {
                if (blurCausedByClickInsideComponent) {
                    $editor.focus();
                    blurCausedByClickInsideComponent = false;
                }
            });

            treeBox = $dropDown.TrivialTreeBox(config);
            treeBox.onSelectedEntryChanged.addListener(function (selectedEntry) {
                if (selectedEntry) {
                    selectEntry(selectedEntry, true, TrivialComponents.objectEquals(selectedEntry, lastCommittedValue));
                    treeBox.setSelectedEntry(null);
                    closeDropDown();
                }
                hideEditor();
            });

            selectEntry(config.selectedEntry, true, true);

            $selectedEntryWrapper.click(function () {
                showEditor();
                $editor.select();
                openDropDown();
                if (entries == null) {
                    query();
                }
            });

            function query(highlightDirection) {
                // call queryFunction asynchronously to be sure the input field has been updated before the result callback is called. Note: the query() method is called on keydown...
                setTimeout(function () {
                    var queryString = getNonSelectedEditorValue();
                    var completeInputString = $editor.val();
                    if (lastQueryString !== queryString || lastCompleteInputQueryString !== completeInputString) {
                        if ($spinners.length === 0) {
                            var $spinner = $(config.spinnerTemplate).appendTo($dropDown);
                            $spinners = $spinners.add($spinner);
                        }
                        config.queryFunction(queryString, {
                            completeInputString: completeInputString,
                            currentlySelectedEntry: selectedEntry
                        }, function (newEntries) {
                            updateEntries(newEntries, highlightDirection);
                        });
                        lastQueryString = queryString;
                        lastCompleteInputQueryString = completeInputString;
                    }
                }, 0);
            }

            function fireChangeEvents(entry) {
                $originalInput.trigger("change");
                me.onSelectedEntryChanged.fire(entry);
            }

            function selectEntry(entry, commit, muteEvent) {
                if (entry == null) {
                    if (config.valueProperty) {
                        $originalInput.val("");
                    }
                    selectedEntry = null;
                    var $selectedEntry = $(Mustache.render(config.emptyEntryTemplate, config.emptyEntry))
                        .addClass("tr-combobox-entry")
                        .addClass("empty");
                    $selectedEntryWrapper.empty().append($selectedEntry);
                } else {
                    if (config.valueProperty) {
                        $originalInput.val(entry[config.valueProperty]);
                    }
                    selectedEntry = entry;
                    var $selectedEntry = $(Mustache.render(config.selectedEntryTemplate, entry))
                        .addClass("tr-combobox-entry");
                    $selectedEntryWrapper.empty().append($selectedEntry);
                    $editor.val(entry[config.inputTextProperty]);
                }
                if (commit) {
                    lastCommittedValue = entry;
                    if (!muteEvent) {
                        fireChangeEvents(entry);
                    }
                }
                if (isEditorVisible) {
                    showEditor(); // reposition editor
                }
                if (isDropDownOpen) {
                    repositionDropDown();
                }
            }

            function isEntrySelected() {
                return selectedEntry != null && selectedEntry !== config.emptyEntry;
            }

            function showEditor() {
                var $editorArea = $selectedEntryWrapper.find(".tr-editor-area");
                if ($editorArea.length === 0) {
                    $editorArea = $selectedEntryWrapper;
                }
                $editor
                    .css({
                        "width": Math.min($editorArea[0].offsetWidth, $trigger ? $trigger[0].offsetLeft - $editorArea[0].offsetLeft : 99999999) + "px", // prevent the editor from surpassing the trigger!
                        "height": ($editorArea.height()) + "px"
                    })
                    .position({
                        my: "left top",
                        at: "left top",
                        of: $editorArea
                    });
                isEditorVisible = true;
            }

            var editorContainsFreeText = function () {
                return config.allowFreeText && $editor.val().length > 0 && !isEntrySelected();
            };

            function hideEditor() {
                $editor.width(0).height(0);
                // show empty entry again if no entry has been selected and free text is not allowed
                if(selectedEntry == null && !config.allowFreeText) {
                    var $selectedEntry = $(Mustache.render(config.emptyEntryTemplate, config.emptyEntry))
                            .addClass("tr-combobox-entry")
                            .addClass("empty");
                    $selectedEntryWrapper.empty().append($selectedEntry);
                }
                isEditorVisible = false;
            }

            var repositionDropDown = function () {
                $dropDown
                    .show()
                    .position({
                        my: "left top",
                        at: "left bottom",
                        of: $treeComboBox,
                        collision: "flip",
                        using: function (calculatedPosition, info) {
                            if (info.vertical === "top") {
                                $treeComboBox.removeClass("dropdown-flipped");
                                $(this).removeClass("flipped");
                            } else {
                                $treeComboBox.addClass("dropdown-flipped");
                                $(this).addClass("flipped");
                            }
                            $(this).css({
                                left: calculatedPosition.left + 'px',
                                top: calculatedPosition.top + 'px'
                            });
                        }
                    })
                    .width($treeComboBox.width());
            };

            function openDropDown() {
                if (dropdownNeeded) {
                    $treeComboBox.addClass("open");
                    repositionDropDown();
                    isDropDownOpen = true;
                }
            }

            function closeDropDown() {
                $treeComboBox.removeClass("open");
                $dropDown.hide();
                isDropDownOpen = false;
            }

            function getNonSelectedEditorValue() {
                return $editor.val().substring(0, $editor[0].selectionStart);
            }

            function autoCompleteIfPossible(delay) {
                if (config.autoComplete) {
                    clearTimeout(autoCompleteTimeoutId);

                    var highlightedEntry = treeBox.getHighlightedEntry();
                    if (highlightedEntry && !doNoAutoCompleteBecauseBackspaceWasPressed) {
                        var autoCompletingEntryDisplayValue = highlightedEntry[config.inputTextProperty];
                        if (autoCompletingEntryDisplayValue) {
                            autoCompleteTimeoutId = setTimeout(function () {
                                var oldEditorValue = getNonSelectedEditorValue();
                                var newEditorValue;
                                if (autoCompletingEntryDisplayValue.toLowerCase().indexOf(oldEditorValue.toLowerCase()) === 0) {
                                    newEditorValue = oldEditorValue + autoCompletingEntryDisplayValue.substr(oldEditorValue.length);
                                } else {
                                    newEditorValue = getNonSelectedEditorValue();
                                }
                                $editor.val(newEditorValue);
                                // $editor[0].offsetHeight;  // we need this to guarantee that the editor has been updated...
                                if ($editor.is(":focus")) {
                                    $editor[0].setSelectionRange(oldEditorValue.length, newEditorValue.length);
                                }
                            }, delay || 0);
                        }
                    }
                    doNoAutoCompleteBecauseBackspaceWasPressed = false;
                }
            }

            this.$ = $treeComboBox;
            $treeComboBox[0].trivialTreeComboBox = this;

            function updateEntries(newEntries, highlightDirection) {
                entries = newEntries;
                $spinners.remove();
                $spinners = $();
                treeBox.updateEntries(newEntries);

                var nonSelectedEditorValue = getNonSelectedEditorValue();
                if (nonSelectedEditorValue.length > 0) {
                    treeBox.highlightTextMatches(newEntries.length <= config.textHighlightingEntryLimit ? nonSelectedEditorValue : null);
                    treeBox.highlightNextMatchingEntry(highlightDirection);
                } else {
                    treeBox.highlightNextEntry(highlightDirection);
                }

                autoCompleteIfPossible(config.autoCompleteDelay);

                if (isDropDownOpen) {
                    openDropDown(); // only for repositioning!
                }
            }

            this.updateEntries = updateEntries;
            this.getSelectedEntry = function () {
                if (selectedEntry == null && (!config.allowFreeText || !$editor.val())) {
                    return null;
                } else if (selectedEntry == null && config.allowFreeText) {
                    var fakeEntry = $.extend({}, config.freeTextEntryValues);
                    fakeEntry[config.inputTextProperty] = $editor.val();
                    return fakeEntry;
                } else {
                    var selectedEntryToReturn = jQuery.extend({}, selectedEntry);
                    selectedEntryToReturn._trEntryElement = undefined;
                    return selectedEntryToReturn;
                }
            };
            this.selectEntry = function(entry, muteEvent) {
                selectEntry(entry, true, muteEvent);
            };
            this.updateChildren = treeBox.updateChildren;
            this.updateNode = treeBox.updateNode;
            this.removeNode = treeBox.removeNode;
            this.focus = function () {
                showEditor();
                $editor.select();
            };
            this.getDropDown = function() {
                return $dropDown;
            };
            this.destroy = function () {
                $originalInput.removeClass('tr-original-input').insertBefore($treeComboBox);
                $treeComboBox.remove();
                $dropDown.remove();
            };
        }

        TrivialComponents.registerJqueryPlugin(TrivialTreeComboBox, "TrivialTreeComboBox", "tr-combobox");

        return $.fn.TrivialTreeComboBox;
    })
);
