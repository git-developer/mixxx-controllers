/**
 * Mixxx controller mapping for a Behringer DDM4000 mixer.
 */
(function(global) {

    var THROTTLE_DELAY = 40;
    var DEFAULT_LONGPRESS_DURATION = 500;
    var DEFAULT_BLINK_DURATION = 425;
    var DEFAULT_DECK_STATE = {
        "beatloop_size": 16,
        "beatjump_size": 1,
        "vinylcontrol_enabled": 1,
        "vinylcontrol_mode": 0,
        "[QuickEffectRack1_${group}_Effect1],enabled": 0,
    };

    /* Shortcut variables */
    var c    = components;
    var e    = global.behringer.extension;
    var cc   = 0xB0;
    var note = 0x90;
    var toggle = c.Button.prototype.types.toggle;

    /**
     * Contains functions to print a message to the log.
     * `debug` output is suppressed unless the caller owns a truthy property `debug`.
     *
     * @param {string} message Message
     * @private
     */
    var log = {
        debug: function(message) {
            if (this.debug) {
                print("[DEBUG] " + message);
            }
        },
        warn: function(message) {
            print("[WARN]  " + message);
        },
        error: function(message) {
            print("[ERROR] " + message);
        },
    };
    var Blinker = function(target, blinkDuration, outValueScale) {
        this.target = target;
        this.outValueScale = outValueScale || c.Component.prototype.outValueScale;

        this.blinkAction = function() {
            this.target.send(this.outValueScale.call(this.target, this.flash = !this.flash));
        };
        this.blinkTimer = new e.Timer({timeout: blinkDuration || 500, action: this.blinkAction, owner: this});
    };
    Blinker.prototype = {
        flash: false,
        handle: function(value) {
            this.blinkTimer.setState(this.flash = value);
            this.target.send(this.outValueScale.call(this.target, value));
        },
    };

    var OnTrackLoadButton = function(options) {
        options = options || {};
        options.outKey = options.outKey || options.key || "track_loaded";
        options.setValues = options.setValues || {};
        c.Button.call(this, options);
    };
    OnTrackLoadButton.prototype = e.deriveFrom(c.Button, {
        output: function(_value, _group, _control) {
            var action = function() {
                Object.keys(this.setValues).forEach(function(key) {
                    var group;
                    var element;
                    var data = key.split(",");
                    if (data.length > 1) {
                        group = data[0].replace("${group}", this.group);
                        element = data[1];
                    } else {
                        group = this.group;
                        element = key;
                    }
                    engine.setValue(group, element, this.setValues[key]);
                }, this);
            };
            /* Insert a small delay to override values applied by mixxx on track load (e.g. beatloop_size) */
            new e.Timer({timeout: 20, oneShot: true, action: action, owner: this}).start();
        },
    });

    var KeyButton = function(options) {
        options = options || {};
        options.key = options.key || "keylock";
        options.longPressTimeout = options.longPressTimeout || DEFAULT_LONGPRESS_DURATION;
        e.LongPressButton.call(this, options);
    };
    KeyButton.prototype = e.deriveFrom(e.LongPressButton, {
        onShortPress: function() {
            engine.setParameter(this.group, "pitch_adjust_set_default", 1);
        },
        onLongPress: function() {
            this.inToggle();
        },
    });

    var createEffectAssignmentButtons = function(options) {
        options = options || {};
        var midiAddresses = options.midiAddresses;
        if (!Array.isArray(midiAddresses) || midiAddresses.length === 0) {
            log.error("At least 1 MIDI address is required to create an EffectAssignmentButton.");
            midiAddresses = [];
        }
        return midiAddresses.map(function(midiAddress, index) {
            return new c.EffectAssignmentButton(
                {group: options.group, midi: midiAddress, effectUnit: index + 1});
        });
    };

    var EffectAssignmentToggleButton = function(options) {
        options = options || {};
        this.buttons = createEffectAssignmentButtons(options);
        c.Button.call(this, options);
    };
    EffectAssignmentToggleButton.prototype = e.deriveFrom(c.Button, {
        input: function(channel, control, value, status, _group) {
            if (this.isPress(channel, control, value, status)) {
                var states = 0;
                this.buttons.forEach(function(b) { states = (states << 1) | b.inGetValue(); });
                states++;
                this.buttons.forEach(function(b, i) { b.inSetValue((states >> i) & 1); });
            }
        }
    });

    var EffectAssignmentLongPressButton = function(options) {
        options = options || {};
        options.longPressTimeout = options.longPressTimeout || DEFAULT_LONGPRESS_DURATION;
        this.buttons = createEffectAssignmentButtons(options);
        e.LongPressButton.call(this, options);
    };
    EffectAssignmentLongPressButton.prototype = e.deriveFrom(e.LongPressButton, {
        onLongPress: function() {
            this.buttons[1].inToggle();
        },
        onRelease: function() {
            if (!this.isLongPressed) {
                this.buttons[0].inToggle();
            }
        },
    });

    /**
     * A button that toggles an echo out effect.
     *
     * @constructor
     * @extends {c.Button}
     * @param {object} options Options object
     * @param {string} options.group (optional) Group of the echo effect control;
     *                                              default: `[EffectRack1_EffectUnit1_Effect1]`
     * @param {Array<string>} additionalEffects (optional) Group of effects that are toggled
     *                                          in addition to the echo effect
     * @public
     */
    var EchoOutButton = function(options) {
        options = options || {};
        if (options.type === undefined) { // do not use '||' to allow 0
            options.type = c.Button.prototype.types.toggle;
        }
        options.echoTimer = null;
        options.affectedChannelVolumes = {}; // required to reset volume until lp#1941040 is fixed
        options.group = options.group || "[EffectRack1_EffectUnit1_Effect1]";
        options.additionalEffects = options.additionalEffects || [];
        if (!Array.isArray(options.additionalEffects)) {
            options.additionalEffects = [options.additionalEffects];
        }
        options.effectGroups = [options.group].concat(options.additionalEffects);
        options.allChannels = this.enumerateChannels();
        c.Button.call(this, options);
    };
    EchoOutButton.prototype = e.deriveFrom(c.Button, {
        enumerateChannels: function() {
            var groupFactory = function(type, countControl, index) {
                index = index || function(i) { return i+1; };
                var count = engine.getValue("[Master]", countControl);
                return _.range(count).map(function(i) { return "[" + type + index.call(null, i) + "]"; });
            };
            return [
                ["Channel", "num_decks"],
                ["Sampler", "num_samplers"],
                ["Auxiliary", "num_auxiliaries"],
                ["Microphone", "num_microphones", function(i) { return i === 0 ? "" : (i+1); }]
            ].reduce(function(items, args) { return items.concat(groupFactory.apply(null, args)); }, []);
        },
        input: function(_channel, _control, value, _status, _group) {
            if (value) {
                this.enableEffect();
            } else {
                this.disableEffect();
            }
        },
        enableEffect: function() {
            var delay = this.prepareEffect(this.group);
            if (delay) {
                this.enableEffectControls(1);
                this.forAffectedChannels(function(channels, _channelVolumes) {
                    this.mute(channels, delay);
                });
            }
        },
        disableEffect: function() {
            this.forAffectedChannels(function(channels, channelVolumes) {
                this.unMute(channels, channelVolumes);
            });
            this.enableEffectControls(0);
        },
        enableEffectControls: function(value) {
            this.effectGroups.forEach(function(group) {
                engine.setValue(group, "enabled", value);
            });
        },

        /**
         * Prepare the effect: find all affected channels, store their volume and calculate the echo delay.
         *
         * @param {string} effectGroup Group of the echo effect
         * @return {number} Echo delay time in ms, or `null` if no channel is affected
         * @private
         */
        prepareEffect: function(effectGroup) {
            var groups = script.individualEffectRegEx.exec(effectGroup);
            if (!Array.isArray(groups) || groups.length < 1) {
                log.error("Effect unit cannot be derived from effect group " + effectGroup);
                return;
            }
            var unitGroup = "[EffectRack1_EffectUnit" + groups[1] + "]";
            var target = this.affectedChannelVolumes;
            this.allChannels.forEach(function(channel) {
                if (engine.getValue(unitGroup, "group_" + channel + "_enable")) {
                    var volume = engine.getValue(channel, "volume");
                    if (volume) {
                        if (engine.getValue(channel, "play_indicator")) {
                            target[channel] = volume;
                        } else if (!script.channelRegEx.test(channel) && !script.samplerRegEx.test(channel)) {
                            target[channel] = volume;
                        }
                    }
                }
            });
            return this.calculateEchoDelay();
        },
        calculateEchoDelay: function() {
            var delay = null;
            this.forAffectedChannels(function(channels, _channelVolumes) {
                channels.forEach(function(channel) {
                    if (!delay) {
                        var bpm = engine.getValue(channel, "bpm");
                        if (bpm) {
                            var beats = 60.0 / bpm;
                            delay = 1000.0 * beats * this.getEchoDelay(this.group);
                        }
                    }
                }, this);
            });
            return delay;
        },

        /**
         * Determine the delay time of an echo effect.
         *
         * @param {string} group Group of the echo effect
         * @return {number} Echo delay time in beats
         * @private
         * @see https://github.com/mixxxdj/mixxx/blob/2.3/src/effects/builtin/echoeffect.cpp#L152
         */
        getEchoDelay: function(group) {
            var quantize = engine.getValue(group, "button_parameter1");
            var triplet = engine.getValue(group, "button_parameter2");
            var delay = engine.getValue(group, "parameter1"); // range: [0, 2]
            var minDelay = 1/8.0;
            var precision = 4.0;
            if (quantize) {
                delay = Math.max(Math.round(delay * precision) / precision, minDelay);
                if (triplet) {
                    delay /= 3.0;
                }
            }
            return delay;
        },
        mute: function(channels, delay) {
            var muteAction = function() {
                channels.forEach(function(channel) { script.triggerControl(channel, "volume_set_zero"); }, this);
            };
            this.stopTimer(); // timer may be pending
            this.echoTimer = new e.Timer({timeout: delay, oneShot: true, action: muteAction, owner: this});
            this.echoTimer.start();
        },
        unMute: function(channels, channelVolumes) {
            this.stopTimer();
            channels.forEach(function(channel) {
                engine.setValue(channel, "volume", channelVolumes[channel]);
                delete channelVolumes[channel];
            }, this);
        },
        stopTimer: function() {
            if (this.echoTimer !== null) {
                this.echoTimer.reset();
                this.echoTimer = null;
            }
        },
        forAffectedChannels: function(action) {
            var channels = Object.keys(this.affectedChannelVolumes);
            if (channels.length) {
                action.call(this, channels, this.affectedChannelVolumes);
            }
        },
    });

    var CrossfaderUnit = function(options) {
        var unitOptions = options || {};
        unitOptions.group = unitOptions.group || "[Master]";
        c.ComponentContainer.call(this, unitOptions);

        var Crossfader = function(options) {
            options = options || {};
            options.inKey = options.inKey || options.key || "crossfader";
            options.group = options.group || unitOptions.group;
            c.Pot.call(this, options);
        };
        Crossfader.prototype = e.deriveFrom(c.Pot, {
            ignoreInput: function() {},
            enable: function() {
                this.input = c.Pot.prototype.input;
            },
            disable: function() {
                this.input = this.ignoreInput;
                engine.setValue("[Master]", "crossfader_set_default", 1);
            },
        });
        var crossfader = new Crossfader(options.crossfader);

        var CrossfaderToggleButton = function(options) {
            options = options || {};
            if (options.type === undefined) {
                options.type = toggle;
            }
            if (!options.inKey && !options.key) {
                options.key = "show_xfader";
            }
            options.group = options.group || unitOptions.group;
            c.Button.call(this, options);
        };
        CrossfaderToggleButton.prototype = e.deriveFrom(c.Button, {
            inSetValue: function(value) {
                if (value) {
                    crossfader.enable();
                } else {
                    crossfader.disable();
                }
                c.Button.prototype.inSetValue.call(this, value);
            },
        });
        this.crossfader = crossfader;
        this.button = new CrossfaderToggleButton(options.button);
    };
    CrossfaderUnit.prototype = e.deriveFrom(c.ComponentContainer);

    /**
     * Button for Crossfader Reverse Tap.
     *
     * Reverses the crossfader orientation as long as the button in pressed.
     * `xFaderReverse` is inverted, not toggled, so that this button may be used in combination
     * with the Reverse Hold button. The LED shows if this button is pressed.
     *
     * @constructor
     * @extends {c.Button}
     * @param {number} options Options object
     * @public
     */
    var CrossfaderReverseTapButton = function(options) {
        options = options || {};
        options.inKey = options.inKey || "xFaderReverse";
        c.Button.call(this, options);
    };
    CrossfaderReverseTapButton.prototype = e.deriveFrom(c.Button, {
        input: function(channel, control, value, _status, _group) {
            this.inToggle();
            this.output(value);
        },
    });

    var CrossfaderAssignLED = function(options) {
        options = options || {};
        options.outKey = options.outKey || "orientation";
        e.CustomButton.call(this, options);
    };
    CrossfaderAssignLED.prototype = e.deriveFrom(e.CustomButton, {
        position: {
            left: 0,
            center: 1,
            right: 2
        }
    });
    var left = CrossfaderAssignLED.prototype.position.left;
    var center = CrossfaderAssignLED.prototype.position.center;
    var right = CrossfaderAssignLED.prototype.position.right;

    var SamplerBank = function(bankOptions) {
        c.ComponentContainer.call(this);
        var bank = this;

        var PlayButton = function(options) {
            options = options || {};
            options.inKey = options.inKey || "cue_gotoandplay";
            options.outKey = options.outKey || "track_loaded";
            if (options.sendShifted === undefined) {
                options.sendShifted = true;
            }
            c.Button.call(this, options);
        };
        PlayButton.prototype = e.deriveFrom(c.Button, {
            inSetValue: function(value) {
                engine.setValue(this.group, this.inKey, value);
                if (!value) {
                    engine.setValue(this.group, "cue_default", 1);
                }
            },
        });
        this.playButton = new PlayButton({
            midi: bankOptions.play,
            group: bankOptions.group,
        });

        var PlayIndicatorLED = function(options) {
            options = options || {};
            options.outKey = options.outKey || "play_indicator";
            this.blinker = new Blinker(this, options.blinkDuration);
            c.Component.call(this, options);
        };
        PlayIndicatorLED.prototype = e.deriveFrom(c.Component, {
            output: function(value, _group, _control) {
                this.blinker.handle(value);
                if (!value) {
                    bank.playButton.trigger();
                }
            },
        });
        this.playIndicator = new PlayIndicatorLED({
            midi: [cc, bankOptions.play[1]],
            group: bankOptions.group,
            blinkDuration: DEFAULT_BLINK_DURATION,
        });

        var ReverseMode = function(options) {
            options = options || {};
            options.key = options.key || "reverse";
            c.Button.call(this, options);
        };
        ReverseMode.prototype = e.deriveFrom(c.Button);
        this.reverseMode = new ReverseMode({midi: bankOptions.reverse, group: bankOptions.group});

        var LoopMode = function(options) {
            options = options || {};
            options.key = options.inKey || "beatloop_activate";
            c.Button.call(this, options);
            this.inSetValue(true);
        };
        LoopMode.prototype = e.deriveFrom(c.Button, {
            outValueScale: function(value) {
                var button = c.Button.prototype;
                bank.playButton.type = value ? button.types.toggle : button.types.push;
                if (!value) {
                    var beatloopSize = engine.getValue(this.group, "beatloop_size");
                    var key = "beatloop_" + beatloopSize;
                    engine.setValue(this.group, key, 0);
                }
                return button.outValueScale(value);
            },
        });
        this.loopMode = new LoopMode({midi: bankOptions.loop, group: bankOptions.group});

        var ModeButton = function(options) {
            options = options || {};
            options.key = options.key || "mode";
            options.longPressTimeout = options.longPressTimeout || DEFAULT_LONGPRESS_DURATION;
            e.LongPressButton.call(this, options);
        };
        ModeButton.prototype = e.deriveFrom(e.LongPressButton, {
            onShortPress: function() {
                this.setBlue(true);
                bank.reverseMode.inToggle();
            },
            onLongPress: function() {
                bank.reverseMode.inToggle();
                bank.loopMode.inToggle();
            },
            onRelease: function() {
                this.setBlue(false);
            },
            setBlue: function(value) {
                midi.sendShortMsg(cc, this.midi[1] + 1, this.outValueScale(value));
            },
        });
        this.modeButton = new ModeButton({midi: bankOptions.mode, group: bankOptions.group});
    };
    SamplerBank.prototype = e.deriveFrom(c.ComponentContainer);

    var DDM4000 = new e.GenericMidiController({
        configurationProvider: function() {
            return {
                throttleDelay: THROTTLE_DELAY,
                init: function() {

                    /*
                    * Prepare outgoing messages for the mixer's LED buttons.
                    * The buttons send `[note, ?]` and the LEDs respond to `[cc, ?]`.
                    * Enable LEDs by adding `sendShifted: true` to a button's `options` object.
                    */
                    c.Button.prototype.shiftChannel = true;
                    c.Button.prototype.shiftOffset = cc - note;
                },
                decks: [
                    { // Channel 1
                        deckNumbers: [1],

                        components: [
                            { // Volume
                                type: e.RangeAwarePot,
                                options: {midi: [cc, 0x07], inKey: "pitch", bound: 6}
                            },
                            { // PFL
                                type: KeyButton, options: {midi: [note, 0x3F], sendShifted: true}
                            },
                            { // Mode
                                type: EffectAssignmentLongPressButton, options: {
                                    midi: [note, 0x03], midiAddresses: [[cc, 0x38], [cc, 0x37]],
                                },
                            },
                            {
                                type: e.EnumToggleButton, shift: true, options: {
                                    midi: [note, 0x03], inKey: "vinylcontrol_mode", maxValue: 2,
                                },
                            },
                            // P1 / High
                            {type: c.Button, options: {midi: [note, 0x00], inKey: "beatlooproll_activate"}},
                            {type: e.BackLoopButton, shift: true, options: {midi: [note, 0x00], type: toggle}},
                            {type: c.Button, options: {midi: [cc, 0x39], outKey: "loop_enabled"}},
                            // P2 / Mid
                            {type: c.Button, options: {midi: [note, 0x01], inKey: "reverseroll"}},
                            {type: c.Button, shift: true, options: {midi: [note, 0x01], inKey: "reverse", type: toggle}},
                            {type: c.Button, options: {midi: [cc, 0x3B], outKey: "reverse"}},
                            // P3 / Low
                            {
                                type: c.Button, shift: true, options: {
                                    midi: [note, 0x02],
                                    group: "[QuickEffectRack1_[Channel1]_Effect1]",
                                    key: "button_parameter1",
                                }
                            },

                            // EQ High
                            {
                                type: e.LoopMoveEncoder, options: {
                                    midi: [cc, 0x04], inKey: "loop_move", sizeControl: "beatjump_size", relative: true
                                }
                            },
                            // EQ Mid
                            {type: e.LoopEncoder, options: {midi: [cc, 0x05], inKey: "beatloop_size"}},
                            {type: e.LoopEncoder, shift: true, options: {midi: [cc, 0x05], inKey: "beatjump_size"}},
                            // EQ Low
                            {
                                type: c.Pot, shift: true, options: {
                                    midi: [cc, 0x06], group: "[QuickEffectRack1_[Channel1]_Effect1]", inKey: "parameter1",
                                }
                            },
                        ],
                        quickEffectUnit: {
                            midi: {
                                enabled: [note, 0x02],
                                super1: [cc, 0x06],
                            },
                            output: {
                                enabled: [cc, 0x3D],
                            },
                        }
                    },
                    { // Channel 2
                        deckNumbers: [1],
                        components: [
                            {type: c.Pot, options: {midi: [cc, 0x0B], inKey: "volume"}}, // Volume
                            { // CF Assign
                                type: e.EnumToggleButton,
                                options: {midi: [note, 0x22],  inKey: "orientation", values: [right, center, left]},
                            },
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x22], onValue: left}}, // CF Assign A
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x23], onValue: right}}, // CF Assign B
                            { // PFL
                                type: c.Button, options: {
                                    midi: [note, 0x49], key: "pfl", type: toggle, sendShifted: true
                                }
                            },
                            {type: c.Button, options: {midi: [note, 0x07],  inKey: null}}, // Mode
                            {type: c.Button, options: {midi: [cc,   0x42], outKey: null}}, // Mode: Multi
                            {type: c.Button, options: {midi: [cc,   0x41], outKey: null}}, // Mode: Single
                            {type: OnTrackLoadButton, options: {setValues: DEFAULT_DECK_STATE}},
                        ],
                        equalizerUnit: { //        P3 / Low,        P2 / Mid,        P1 / High
                            midi: { // eslint-disable-next-line key-spacing
                                parameterKnobs:   {1: [cc,   0x0A], 2: [cc,   0x09], 3: [cc,   0x08]},
                                parameterButtons: {1: [note, 0x06], 2: [note, 0x05], 3: [note, 0x04]},
                            },
                            output: {
                                parameterButtons: {1: [cc,   0x47], 2: [cc,   0x45], 3: [cc,   0x43]}, // Amber
                                // parameterButtons: {1: [cc,   0x48], 2: [cc,   0x46], 3: [cc,   0x44]}, // Green
                            },
                        },
                    },
                    { // Channel 3
                        deckNumbers: [2],
                        components: [
                            {type: c.Pot, options: {midi: [cc, 0x0F],  inKey: "volume"}}, // Volume
                            { // CF Assign
                                type: e.EnumToggleButton,
                                options: {midi: [note, 0x24],  inKey: "orientation", values: [left, right, center]}
                            },
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x24], onValue: left}}, // CF Assign A
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x25], onValue: right}}, // CF Assign B
                            { // PFL
                                type: c.Button, options: {
                                    midi: [note, 0x53], key: "pfl", type: toggle, sendShifted: true
                                }
                            },
                            {type: c.Button, options: {midi: [note, 0x0B],  inKey: null}}, // Mode
                            {type: c.Button, options: {midi: [cc,   0x4C], outKey: null}}, // Mode: Multi
                            {type: c.Button, options: {midi: [cc,   0x4B], outKey: null}}, // Mode: Single
                            {type: OnTrackLoadButton, options: {setValues: DEFAULT_DECK_STATE}},
                        ],
                        equalizerUnit: { //        P3 / Low,        P2 / Mid,        P1 / High
                            midi: { // eslint-disable-next-line key-spacing
                                parameterKnobs:   {1: [cc,   0x0E], 2: [cc,   0x0D], 3: [cc,   0x0C]},
                                parameterButtons: {1: [note, 0x0A], 2: [note, 0x09], 3: [note, 0x08]},
                            },
                            output: {
                                parameterButtons: {1: [cc,   0x51], 2: [cc,   0x4F], 3: [cc,   0x4D]}, // Amber
                                // parameterButtons: {1: [cc,   0x52], 2: [cc,   0x50], 3: [cc,   0x4E]}, // Green
                            },
                        },
                    },
                    { // Channel 4
                        deckNumbers: [2],
                        components: [
                            // Volume
                            {type: e.RangeAwarePot, options: {midi: [cc, 0x13], inKey: "pitch", bound: 6}},
                            // PFL
                            {type: KeyButton, options: {midi: [note, 0x5D], sendShifted: true}},
                            // Mode
                            {
                                type: EffectAssignmentLongPressButton, options: {
                                    midi: [note, 0x0F], midiAddresses: [[cc, 0x56], [cc, 0x55]],
                                },
                            },
                            {
                                type: e.EnumToggleButton, shift: true, options: {
                                    midi: [note, 0x0F], inKey: "vinylcontrol_mode", maxValue: 2,
                                },
                            },
                            // P1 / High
                            {type: c.Button, options: {midi: [note, 0x0C], inKey: "beatlooproll_activate"}},
                            {type: e.BackLoopButton, shift: true, options: {midi: [note, 0x0C], type: toggle}},
                            {type: c.Button, options: {midi: [cc, 0x57], outKey: "loop_enabled"}},
                            // P2 / Mid
                            {type: c.Button, options: {midi: [note, 0x0D], inKey: "reverseroll"}},
                            {type: c.Button, shift: true, options: {midi: [note, 0x0D], inKey: "reverse", type: toggle}},
                            {type: c.Button, options: {midi: [cc, 0x59], outKey: "reverse"}},
                            // P3 / Low
                            {
                                type: c.Button, shift: true, options: {
                                    midi: [note, 0x0E],
                                    group: "[QuickEffectRack1_[Channel2]_Effect1]",
                                    key: "button_parameter1",
                                }
                            },
                            { // EQ High
                                type: e.LoopMoveEncoder, options: {
                                    midi: [cc, 0x10], inKey: "loop_move", sizeControl: "beatjump_size", relative: true
                                }
                            },
                            // EQ Mid
                            {type: e.LoopEncoder, options: {midi: [cc, 0x11], inKey: "beatloop_size"}},
                            {type: e.LoopEncoder, shift: true, options: {midi: [cc, 0x11], inKey: "beatjump_size"}},
                            // EQ Low
                            {
                                type: c.Pot, shift: true, options: {
                                    midi: [cc, 0x12], group: "[QuickEffectRack1_[Channel2]_Effect1]", inKey: "parameter1",
                                }
                            },
                        ],
                        quickEffectUnit: {
                            midi: {
                                enabled: [note, 0x0E],
                                super1: [cc, 0x12],
                            },
                            output: {
                                enabled: [cc, 0x5B],
                            },
                        }
                    },
                ],
                effectUnits: [{
                    sendShiftedFor: c.Button,
                    unitNumbers: [1, 2],
                    midi: {
                        dryWetKnob: [cc, 0x03], // Sampler: Volume/Mix
                        effectFocusButton: [note, 0x34], // Mic: Talk On
                        enableButtons: {
                            1: [note, 0x31], // Mic: Setup
                            2: [note, 0x32], // Mic: XMC On
                            3: [note, 0x33], // Mic: FX On
                        },
                        knobs: {
                            1: [cc, 0x00], // Mic: EQ Low
                            2: [cc, 0x01], // Mic: EQ Mid
                            3: [cc, 0x02], // Mic: EQ High
                        },
                    },
                }],
                containers: [
                    { // Effect Unit 1
                        components: [
                            { // Mic: On/Off
                                type: e.ShiftButton, options: {
                                    midi: [note, 0x35],
                                    group: "[Controls]",
                                    key: "touch_shift",
                                    sendShifted: true,
                                    target: this
                                }
                            },
                        ]
                    },
                    { // Crossfader
                        defaultDefinition: {type: c.Button, options: {group: "[Mixer Profile]"}},
                        components: [
                            {options: {midi: [cc,   0x14]}, type: e.CrossfaderCurvePot}, // Crossfader: Curve
                            {options: {midi: [note, 0x28], sendShifted: true}, type: CrossfaderReverseTapButton}, // Crossfader: Reverse Tap
                            {options: {midi: [note, 0x29], key: "xFaderReverse", type: toggle, sendShifted: true}}, // Crossfader: Reverse Hold
                        ]
                    },
                    { // Crossfader
                        defaultDefinition: {type: c.Button, options: {group: "[Master]"}},
                        components: [
                            { // Crossfader: On
                                type: CrossfaderUnit, options: {
                                    crossfader: {midi: [cc, 0x15]},
                                    button: {group: "[Skin]", midi: [note, 0x1F], sendShifted: true},
                                },
                            },
                            {options: {midi: [note, 0x17],    key: null, sendShifted: true}}, // Crossfader: A Full Freq
                            {options: {midi: [note, 0x18],    key: null, sendShifted: true}}, // Crossfader: A High
                            {options: {midi: [note, 0x19],    key: null, sendShifted: true}}, // Crossfader: A Mid
                            {options: {midi: [note, 0x1A],    key: null, sendShifted: true}}, // Crossfader: A Low
                            {options: {midi: [note, 0x1B],    key: null, sendShifted: true}}, // Crossfader: B Full Freq
                            {options: {midi: [note, 0x1C],    key: null, sendShifted: true}}, // Crossfader: B High
                            {options: {midi: [note, 0x1D],    key: null, sendShifted: true}}, // Crossfader: B Mid
                            {options: {midi: [note, 0x1E],    key: null, sendShifted: true}}, // Crossfader: B Low
                            {options: {midi: [note, 0x2A],    key: null, sendShifted: true}}, // Crossfader: Bounce to MIDI Clock
                            {options: {midi: [note, 0x2B],  inKey: null}}, // Crossfader: Beat (Left)
                            {options: {midi: [note, 0x2C],  inKey: null}}, // Crossfader: Beat (Right)
                            {options: {midi: [cc,   0x2B], outKey: null}}, // Crossfader: Beat 1
                            {options: {midi: [cc,   0x2C], outKey: null}}, // Crossfader: Beat 2
                            {options: {midi: [cc,   0x2D], outKey: null}}, // Crossfader: Beat 4
                            {options: {midi: [cc,   0x2E], outKey: null}}, // Crossfader: Beat 8
                            {options: {midi: [cc,   0x2F], outKey: null}}, // Crossfader: Beat 16
                        ]
                    },
                    { // Sampler: Echo Time Buttons
                        defaultDefinition: {
                            type: e.EnumToggleButton,
                            options: {group: "[EffectRack1_EffectUnit1_Effect1]", inKey: "parameter1"}
                        },
                        components: [
                            {options: {midi: [note, 0x60], values: [0, 0.25, 0.5, 0.75, 1, 1.5, 2]}}, // Sampler: REC Source (Right)
                            {options: {midi: [note, 0x61], values: [2, 1.5, 1, 0.75, 0.5, 0.25, 0]}}, // Sampler: REC Source (Left)
                        ]
                    },
                    { // Sampler: Echo Time LEDs
                        defaultDefinition: {
                            type: e.CustomButton,
                            options: {group: "[EffectRack1_EffectUnit1_Effect1]", outKey: "parameter1"}
                        },
                        components: [
                            {options: {midi: [cc,   0x60], onValue: 0}}, // Sampler: REC Source 1
                            {options: {midi: [cc,   0x61], onValue: 0.25}}, // Sampler: REC Source 2
                            {options: {midi: [cc,   0x62], onValue: 0.5}}, // Sampler: REC Source 3
                            {options: {midi: [cc,   0x63], onValue: 0.75}}, // Sampler: REC Source 4
                            {options: {midi: [cc,   0x64], onValue: 1}}, // Sampler: REC Source Microphone
                            {options: {midi: [cc,   0x65], onValue: 1.5}}, // Sampler: REC Source Master
                        ]
                    },
                    { // Sampler
                        defaultDefinition: {type: c.Button, options: {group: "[Sampler1]"}},
                        components: [
                            // {options: {midi: [cc,   0x03],  inKey: "volume"}, type: c.Pot}, // Sampler: Volume/Mix
                            { // Sampler: Insert
                                type: EchoOutButton, options: {
                                    group: "[EffectRack1_EffectUnit1_Effect1]",
                                    midi: [note, 0x5F],
                                    additionalEffects: "[EffectRack1_EffectUnit1_Effect2]"
                                }
                            },
                            // {options: {midi: [note, 0x60],  inKey: null}}, // Sampler: REC Source (Right)
                            // {options: {midi: [note, 0x61],  inKey: null}}, // Sampler: REC Source (Left)
                            // {options: {midi: [cc,   0x60], outKey: null}}, // Sampler: REC Source 1
                            // {options: {midi: [cc,   0x61], outKey: null}}, // Sampler: REC Source 2
                            // {options: {midi: [cc,   0x62], outKey: null}}, // Sampler: REC Source 3
                            // {options: {midi: [cc,   0x63], outKey: null}}, // Sampler: REC Source 4
                            // {options: {midi: [cc,   0x64], outKey: null}}, // Sampler: REC Source Microphone
                            // {options: {midi: [cc,   0x65], outKey: null}}, // Sampler: REC Source Master
                            {options: {midi: [note, 0x66],    key: "pfl", sendShifted: true}}, // Sampler: PFL
                            {options: {midi: [note, 0x67],  inKey: "beatloop_size", values: [1, 2, 4, 8, 16, 256]}, type: e.EnumToggleButton}, // Sampler: Sample Length (Right)
                            {options: {midi: [note, 0x68],  inKey: "beatloop_size", values: [256, 16, 8, 4, 2, 1]}, type: e.EnumToggleButton}, // Sampler: Sample Length (Left)
                            {options: {midi: [cc,   0x67], outKey: "beatloop_size", onValue: 1},   type: e.CustomButton}, // Sampler: Sample Length 1
                            {options: {midi: [cc,   0x68], outKey: "beatloop_size", onValue: 2},   type: e.CustomButton}, // Sampler: Sample Length 2
                            {options: {midi: [cc,   0x69], outKey: "beatloop_size", onValue: 4},   type: e.CustomButton}, // Sampler: Sample Length 4
                            {options: {midi: [cc,   0x6A], outKey: "beatloop_size", onValue: 8},   type: e.CustomButton}, // Sampler: Sample Length 8
                            {options: {midi: [cc,   0x6B], outKey: "beatloop_size", onValue: 16},  type: e.CustomButton}, // Sampler: Sample Length 16
                            {options: {midi: [cc,   0x6C], outKey: "beatloop_size", onValue: 256}, type: e.CustomButton}, // Sampler: Sample Length ∞
                            {options: {midi: [note, 0x6D],    key: null, sendShifted: true}}, // Sampler: Record / In
                            {options: {midi: [note, 0x6C],  inKey: null}}, // Sampler: Bank Assign
                            { // Sampler Bank 1
                                type: SamplerBank,
                                options: {
                                    play: [note,  0x6E], // Sampler: Bank 1 Play / Out
                                    reverse: [cc, 0x6F], // Sampler: Bank 1 Reverse
                                    loop: [cc,    0x70], // Sampler: Bank 1 Loop
                                    mode: [note,  0x71], // Sampler: Bank 1 Mode
                                },
                            },
                            { // Sampler Bank 2
                                type: SamplerBank,
                                options: {
                                    group: "[Sampler2]",
                                    play: [note,  0x73], // Sampler: Bank 2 Play / Out
                                    reverse: [cc, 0x74], // Sampler: Bank 2 Reverse
                                    loop: [cc,    0x75], // Sampler: Bank 2 Loop
                                    mode: [note,  0x76], // Sampler: Bank 2 Mode
                                },
                            },
                            { // Sampler: FX On
                            /*
                            * When the sampler is in audio (non-midi) mode, this button causes a
                            * brake effect. Mixxx supports brake only for decks, not for samplers:
                            * - https://github.com/mixxxdj/mixxx/blob/a2866dfe9d9004e68610aa2d53220957954bfca3/src/controllers/engine/controllerengine.cpp#L1251
                            *   void ControllerEngineJSProxy::brake(int deck, bool activate, double factor = 1.0, double rate = 1.0)
                            * Thus we toggle effect unit 1 for the sampler instead.
                            */
                                type: e.BlinkingButton,
                                options: {
                                    midi: [note, 0x78], type: toggle, sendShifted: true,
                                    group: "[EffectRack1_EffectUnit1]", key: "group_[Sampler1]_enable",
                                    blinkDuration: DEFAULT_BLINK_DURATION,
                                }
                            },
                            {options: {midi: [note, 0x79], key: null, sendShifted: true}}, // Sampler: Select
                            { // Sampler: CF Assign
                                type: e.EnumToggleButton,
                                options: {midi: [note, 0x7A], inKey: "orientation", values: [center, left, right]},
                            },
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x7A], onValue: left}}, // Sampler: CF Assign A
                            {type: CrossfaderAssignLED, options: {midi: [cc, 0x7B], onValue: right}}, // Sampler: CF Assign B
                            {options: {midi: [note, 0x7C], key: null, sendShifted: true}}, // Sampler: CF Start
                        ]
                    }
                ],
            };
        }
    });

    var exports = {};
    exports.Blinker = Blinker;
    exports.OnTrackLoadButton = OnTrackLoadButton;
    exports.KeyButton = KeyButton;
    exports.EffectAssignmentToggleButton = EffectAssignmentToggleButton;
    exports.EffectAssignmentLongPressButton = EffectAssignmentLongPressButton;
    exports.EchoOutButton = EchoOutButton;
    exports.CrossfaderUnit = CrossfaderUnit;
    exports.CrossfaderReverseTapButton = CrossfaderReverseTapButton;
    exports.CrossfaderAssignLED = CrossfaderAssignLED;
    exports.SamplerBank = SamplerBank;
    global.behringer = _.assign(global.behringer, {ddm4000: exports});
    global.DDM4000 = DDM4000;
})(this);
