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
            define('trivial-calendarbox', ['trivial-core', 'jquery', 'mustache'], factory);
        } else if (typeof exports === 'object') {
            // Node/CommonJS
            module.exports = factory(require('trivial-core'), require('jquery'), require('mustache'));
        } else if (jQuery && !jQuery.fn.trivialcalendarbox) {
            // Define using browser globals otherwise
            // Prevent multiple instantiations if the script is loaded twice
            factory(TrivialComponents, jQuery, Mustache);
        }
    }(function (TrivialComponents, $, Mustache) {

        function TrivialCalendarBox($container, options) {
            var me = this;

            options = options || {};
            var config = $.extend({
                selectedDate: moment(),
                firstDayOfWeek: 1,
                mode: 'datetime', // 'date', 'time', 'datetime',
                highlightKeyboardNavigationState: false
            }, options);

            this.onChange = new TrivialComponents.Event();

            var keyboardNavigationState = config.mode == 'time' ? 'hour' : 'day'; // 'year','month','day','hour','minute'
            var keyboardNavCssClass = config.highlightKeyboardNavigationState ? "keyboard-nav" : "";

            var selectedDate = config.selectedDate;

            var $calendarBox = $('<div class="tr-calendarbox"/>').appendTo($container);

            var $calendarDisplay = $('<div class="tr-calendar-display"/>');
            var $yearDisplay = $('<div class="year"><span class="back-button"/><span class="name"/><span class="forward-button"/></div>').appendTo($calendarDisplay);
            var $monthDisplay = $('<div class="month"><span class="back-button"/><span class="name"/><span class="forward-button"/></div>').appendTo($calendarDisplay);
            var $monthTable = $('<div class="month-table">').appendTo($calendarDisplay);
            var $year = $yearDisplay.find(".name");
            var $month = $monthDisplay.find(".name");
            $yearDisplay.click(setKeyboardNavigationState.bind(this, "year"));
            $yearDisplay.find('.back-button').click(navigate.bind(this, "year", "left", true));
            $yearDisplay.find('.forward-button').click(navigate.bind(this, "year", "right", true));
            $monthDisplay.click(setKeyboardNavigationState.bind(this, "month"));
            $monthDisplay.find('.back-button').click(navigate.bind(this, "month", "left", true));
            $monthDisplay.find('.forward-button').click(navigate.bind(this, "month", "right", true));

            var $clockDisplay = $('<div class="tr-clock-display"/>')
                .append('<svg class="clock" viewBox="0 0 100 100" width="100" height="100"> ' +
                '<circle class="clockcircle" cx="50" cy="50" r="45"/> ' +
                '<g class="ticks" > ' +
                ' <line x1="50" y1="5.000" x2="50.00" y2="10.00"/> <line x1="72.50" y1="11.03" x2="70.00" y2="15.36"/> <line x1="88.97" y1="27.50" x2="84.64" y2="30.00"/> <line x1="95.00" y1="50.00" x2="90.00" y2="50.00"/> <line x1="88.97" y1="72.50" x2="84.64" y2="70.00"/> <line x1="72.50" y1="88.97" x2="70.00" y2="84.64"/> <line x1="50.00" y1="95.00" x2="50.00" y2="90.00"/> <line x1="27.50" y1="88.97" x2="30.00" y2="84.64"/> <line x1="11.03" y1="72.50" x2="15.36" y2="70.00"/> <line x1="5.000" y1="50.00" x2="10.00" y2="50.00"/> <line x1="11.03" y1="27.50" x2="15.36" y2="30.00"/> <line x1="27.50" y1="11.03" x2="30.00" y2="15.36"/> ' +
                '</g> ' +
                '<g class="numbers">' +
                ' <text x="50" y="22">12</text> <text x="85" y="55">3</text> <text x="50" y="88">6</text> <text x="15" y="55">9</text> ' +
                '</g> ' +
                '<g class="hands">' +
                ' <line class="minutehand" x1="50" y1="50" x2="50" y2="20"/>' +
                ' <line class="hourhand" x1="50" y1="50" x2="50" y2="26"/> ' +
                '</g> ' +
                '<g class="am-pm-box">' +
                ' <rect x="58" y="59" width="20" height="15"/>' +
                ' <text class="am-pm-text" x="60" y="70" >??</text>' +
                '</g>' +
                '</svg>'
            ).append('<div class="digital-time-display"><div class="hour-wrapper">' +
                '<div class="up-button"/><div class="hour">??</div><div class="down-button"/>' +
                '</div>:<div class="minute-wrapper">' +
                '<div class="up-button"/><div class="minute">??</div><div class="down-button"/>' +
                '</div></div>');
            var $hourHand = $clockDisplay.find('.hourhand');
            var $minuteHand = $clockDisplay.find('.minutehand');
            var $amPmText = $clockDisplay.find('.am-pm-text');
            var $digitalTimeHourDisplayWrapper = $clockDisplay.find('.digital-time-display .hour-wrapper');
            var $digitalTimeHourDisplay = $clockDisplay.find('.digital-time-display .hour');
            $digitalTimeHourDisplayWrapper.click(setKeyboardNavigationState.bind(this, "hour"));
            $digitalTimeHourDisplayWrapper.find(".up-button").click(navigate.bind(this, "hour", "up", true));
            $digitalTimeHourDisplayWrapper.find(".down-button").click(navigate.bind(this, "hour", "down", true));
            var $digitalTimeMinuteDisplayWrapper = $clockDisplay.find('.digital-time-display .minute-wrapper');
            var $digitalTimeMinuteDisplay = $clockDisplay.find('.digital-time-display .minute');
            $digitalTimeMinuteDisplayWrapper.click(setKeyboardNavigationState.bind(this, "minute"));
            $digitalTimeMinuteDisplayWrapper.find(".up-button").click(navigate.bind(this, "minute", "up", true));
            $digitalTimeMinuteDisplayWrapper.find(".down-button").click(navigate.bind(this, "minute", "down", true));

            if (config.mode == 'date' || config.mode == 'datetime') {
                $calendarDisplay.appendTo($calendarBox)
            }
            if (config.mode == 'time' || config.mode === 'datetime') {
                $clockDisplay.appendTo($calendarBox);
            }

            if (selectedDate) { // if config.entries was set...
                updateMonthDisplay(selectedDate);
                updateClockDisplay(selectedDate);
            } else {
                updateMonthDisplay(moment());
                updateClockDisplay(moment());
            }

            function getDaysForCalendarDisplay(dateInMonthDoBeDisplayed, firstDayOfWeek /*1 mo, 7 su*/) {
                var firstDayOfMonth = dateInMonthDoBeDisplayed.clone().utc().startOf('month').hour(12); // mid-day to prevent strange daylight-saving effects.
                var firstDayToBeDisplayed = firstDayOfMonth.clone().isoWeekday(firstDayOfWeek <= firstDayOfMonth.isoWeekday() ? firstDayOfWeek : firstDayOfWeek - 7);

                var daysOfMonth = [];
                for (var day = firstDayToBeDisplayed.clone(); daysOfMonth.length < 42; day.add(1, 'day')) {
                    daysOfMonth.push(day.clone());
                }
                return daysOfMonth;
            }

            function updateMonthDisplay(dateInMonthToBeDisplayed) {
                $year.text(dateInMonthToBeDisplayed.year());
                $month.text(moment.months()[dateInMonthToBeDisplayed.month()]);
                $monthTable.remove();
                $monthTable = $('<div class="month-table">').appendTo($calendarDisplay);

                var daysToBeDisplayed = getDaysForCalendarDisplay(dateInMonthToBeDisplayed, 1);

                var $tr = $('<tr>').appendTo($monthTable);
                for (var i = 0; i < 7; i++) {
                    $tr.append('<th>' + moment.weekdaysMin()[(config.firstDayOfWeek + i) % 7] + '</th>');
                }
                for (var w = 0; w < daysToBeDisplayed.length / 7; w++) {
                    $tr = $('<tr>').appendTo($monthTable);
                    for (var d = 0; d < 7; d++) {
                        var day = daysToBeDisplayed[w * 7 + d];
                        var $td = $('<td>' + day.date() + '</td>');
                        if (day.month() == dateInMonthToBeDisplayed.month()) {
                            $td.addClass('current-month');
                        } else {
                            $td.addClass('other-month');
                        }
                        if (day.year() == moment().year() && day.dayOfYear() == moment().dayOfYear()) {
                            $td.addClass('today');
                        }
                        if (day.year() == selectedDate.year() && day.dayOfYear() == selectedDate.dayOfYear()) {
                            $td.addClass('selected');
                            if (keyboardNavigationState === 'day') {
                                $td.addClass(keyboardNavCssClass);
                            }
                        }
                        $td.click(function (day) {
                            return function () {
                                setKeyboardNavigationState("day");
                                setMonthAndDay(day.month() + 1, day.date(), true);
                            };
                        }(day));
                        $tr.append($td);
                    }
                }
            }

            function updateClockDisplay(date) {
                $amPmText.text(date.hour() >= 12 ? 'pm' : 'am');
                var minutesAngle = date.minute() * 6;
                var hours = (date.hour() % 12) + date.minute() / 60;
                var hourAngle = hours * 30;
                $hourHand.attr("transform", "rotate(" + hourAngle + ",50,50)");
                $minuteHand.attr("transform", "rotate(" + minutesAngle + ",50,50)");

                $digitalTimeHourDisplay.text(date.format('HH'));
                $digitalTimeMinuteDisplay.text(date.format('mm'));
            }

            var updateDisplay = function () {
                updateMonthDisplay(selectedDate);
                updateClockDisplay(selectedDate);
            };

            function setSelectedDate(moment) {
                selectedDate = moment;
                updateDisplay();
            }

            function setYear(year, fireEvent) {
                selectedDate.year(year);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('year');
                }
            }

            function setMonth(month, fireEvent) {
                selectedDate.month(month - 1);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('month');
                }
            }

            function setDayOfMonth(dayOfMonth, fireEvent) {
                selectedDate.date(dayOfMonth);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('day');
                }
            }

            function setMonthAndDay(month, day, fireEvent) {
                selectedDate.month(month - 1);
                selectedDate.date(day);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('month');
                    fireChangeEvents('day');
                }
            }

            function setHour(hour, fireEvent) {
                selectedDate.hour(hour);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('hour');
                }
            }

            function setMinute(minute, fireEvent) {
                selectedDate.minute(minute);
                updateDisplay();
                if (fireEvent) {
                    fireChangeEvents('minute');
                }
            }

            function fireChangeEvents(type) {
                $calendarBox.trigger("change");
                me.onChange.fire(type, me.getSelectedDate());
            }

            function setKeyboardNavigationState(newKeyboardNavigationState) {
                keyboardNavigationState = newKeyboardNavigationState;
                $($yearDisplay).add($monthDisplay).add($monthTable.find('td.keyboard-nav')).add($hourHand).add($digitalTimeHourDisplayWrapper).add($minuteHand).add($digitalTimeMinuteDisplayWrapper)
                    .each(function () {
                        $(this).attr("class", $(this).attr("class").replace(keyboardNavCssClass, ''));
                    });
                if (keyboardNavigationState == 'year') {
                    $yearDisplay.addClass(keyboardNavCssClass);
                } else if (keyboardNavigationState == 'month') {
                    $monthDisplay.addClass(keyboardNavCssClass);
                } else if (keyboardNavigationState == 'day') {
                    $monthTable.find(".selected").addClass(keyboardNavCssClass);
                } else if (keyboardNavigationState == 'hour') {
                    $hourHand.attr("class", "hourhand keyboard-nav");
                    $digitalTimeHourDisplayWrapper.addClass(keyboardNavCssClass);
                } else if (keyboardNavigationState == 'minute') {
                    $minuteHand.attr("class", "minutehand keyboard-nav");
                    $digitalTimeMinuteDisplayWrapper.addClass(keyboardNavCssClass);
                }
            }

            this.$ = $calendarBox;
            this.setSelectedDate = setSelectedDate;
            this.getSelectedDate = function () {
                return selectedDate;
            };
            this.setYear = setYear;
            this.setMonth = setMonth;
            this.setDayOfMonth = setDayOfMonth;
            this.setHour = setHour;
            this.setMinute = setMinute;

            function navigate(unit /* year, month, day, hour, minute*/, direction /*up, left, down, right, tab*/, fireEvent) { // returns true if effectively navigated, false if nothing has changed
                if (unit == 'year') {
                    if (direction == 'down' || direction == 'left') {
                        setYear(selectedDate.year() - 1, fireEvent);
                    } else if (direction == 'up' || direction == 'right') {
                        setYear(selectedDate.year() + 1, fireEvent);
                    }
                    return true;
                } else if (unit == 'month') {
                    if (direction == 'down' || direction == 'left') {
                        setMonth(selectedDate.month(), fireEvent);
                    } else if (direction == 'up' || direction == 'right') {
                        setMonth(selectedDate.month() + 2, fireEvent);
                    }
                    return true;
                } else if (unit == 'day') {
                    if (direction == 'down') {
                        selectedDate.dayOfYear(selectedDate.dayOfYear() + 7);
                    } else if (direction == 'left') {
                        selectedDate.dayOfYear(selectedDate.dayOfYear() - 1);
                    } else if (direction == 'up') {
                        selectedDate.dayOfYear(selectedDate.dayOfYear() - 7);
                    } else if (direction == 'right') {
                        selectedDate.dayOfYear(selectedDate.dayOfYear() + 1);
                    }
                    updateDisplay();
                    fireChangeEvents('day');
                    return true;
                } else if (unit == 'hour') {
                    if (direction == 'down' || direction == 'left') {
                        setHour(selectedDate.hour() - 1, fireEvent);
                    } else if (direction == 'up' || direction == 'right') {
                        setHour(selectedDate.hour() + 1, fireEvent);
                    }
                    return true;
                } else if (unit == 'minute') {
                    if (direction == 'down' || direction == 'left') {
                        setMinute(selectedDate.minute() - (selectedDate.minute() % 5) - 5, fireEvent);
                    } else if (direction == 'up' || direction == 'right') {
                        setMinute(selectedDate.minute() - (selectedDate.minute() % 5) + 5, fireEvent);
                    }
                    return true;
                }
            }

            this.setKeyboardNavigationState = setKeyboardNavigationState;

            this.navigate = function (direction /*up, left, down, right*/) { // returns true if effectively navigated, false if nothing has changed
                navigate(keyboardNavigationState, direction);
            };
        }

        TrivialComponents.registerJqueryPlugin(TrivialCalendarBox, "TrivialCalendarBox", "tr-calendarbox");

        return $.fn.TrivialCalendarBox;
    })
);
