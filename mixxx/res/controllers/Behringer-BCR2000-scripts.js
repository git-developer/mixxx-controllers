/**
 * Mixxx controller mapping for a Behringer BCR2000 controller.
 */

/* Globally available objects are declared as variables to avoid linter errors */
var behringer = behringer, BCR2000Preset = BCR2000Preset;

var BCR2000 = new behringer.extension.GenericMidiController({
    configurationProvider: function() {

        /* Shortcut variables */
        const c = components;
        const e = behringer.extension;
        const p = BCR2000Preset;
        const cc = p.STATUS_CONTROL_CHANGE;

        return {
            init: function() {
                p.setPreset(1);
            },
            decks: [{
                deckNumbers: [1],
                components: [
                    {
                        type: c.EffectAssignmentButton, options: {
                            midi: [cc, p.buttonBox[0]],
                            effectUnit: 1,
                            type: c.Button.prototype.types.push
                        }
                    },
                    {
                        type: c.EffectAssignmentButton, options: {
                            midi: [cc, p.buttonBox[2]],
                            effectUnit: 2,
                            type: c.Button.prototype.types.push
                        }
                    },
                ],
            },
            {
                deckNumbers: [2],
                components: [
                    {
                        type: c.EffectAssignmentButton, options: {
                            midi: [cc, p.buttonBox[1]],
                            effectUnit: 1,
                            type: c.Button.prototype.types.push
                        }
                    },
                    {
                        type: c.EffectAssignmentButton, options: {
                            midi: [cc, p.buttonBox[3]],
                            effectUnit: 2,
                            type: c.Button.prototype.types.push
                        }
                    },
                ],
            }],
            effectUnits: [{
                feedback: true,
                feedbackOnRelease: true,
                unitNumbers: [1],
                midi: {
                    effectFocusButton: [cc, p.buttonRow1[0]],
                    enableButtons: {
                        1: [cc, p.buttonRow2[1]],
                        2: [cc, p.buttonRow2[2]],
                        3: [cc, p.buttonRow2[3]],
                    },
                    knobs: {
                        1: [cc, p.pushEncoderGroup1[1].encoder],
                        2: [cc, p.pushEncoderGroup1[2].encoder],
                        3: [cc, p.pushEncoderGroup1[3].encoder],
                    },
                    dryWetKnob: [cc, p.pushEncoderGroup1[0].encoder],
                },
            },
            {
                feedback: true,
                feedbackOnRelease: true,
                unitNumbers: [2],
                midi: {
                    effectFocusButton: [cc, p.buttonRow1[7]],
                    enableButtons: {
                        1: [cc, p.buttonRow2[4]],
                        2: [cc, p.buttonRow2[5]],
                        3: [cc, p.buttonRow2[6]],
                    },
                    knobs: {
                        1: [cc, p.pushEncoderGroup1[4].encoder],
                        2: [cc, p.pushEncoderGroup1[5].encoder],
                        3: [cc, p.pushEncoderGroup1[6].encoder],
                    },
                    dryWetKnob: [cc, p.pushEncoderGroup1[7].encoder],
                }
            }],
            containers: [{
                defaultDefinition: {
                    type: e.ShiftButton,
                    options: {group: "[Controls]", key: "touch_shift", target: this}
                },
                components: [
                    {options: {midi: [cc, p.buttonRow2[0]]}},
                    {options: {midi: [cc, p.buttonRow2[7]]}},
                ],
            },
            {
                defaultDefinition: {type: c.Button, options: {inKey: "enabled", type: c.Button.prototype.types.push}},
                components: [
                    {options: {midi: [cc, p.pushEncoderGroup1[0].button], group: "[EffectRack1_EffectUnit1]"}},
                    {options: {midi: [cc, p.pushEncoderGroup1[7].button], group: "[EffectRack1_EffectUnit2]"}},
                ]
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit1_Effect1]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[1]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[1]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[1]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[1]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[1].button], key: "button_parameter2"}},
                ],
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit1_Effect2]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[2]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[2]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[2]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[2]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[2].button], key: "button_parameter2"}},
                ],
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit1_Effect3]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[3]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[3]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[3]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[3]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[3].button], key: "button_parameter2"}},
                ],
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit2_Effect1]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[4]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[4]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[4]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[4]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[4].button], key: "button_parameter2"}},
                ],
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit2_Effect2]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[5]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[5]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[5]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[5]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[5].button], key: "button_parameter2"}},
                ],
            },
            {
                defaultDefinition: {options: {group: "[EffectRack1_EffectUnit2_Effect3]"}},
                components: [
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow1[6]], key: "parameter1"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow2[6]], key: "parameter2"}},
                    {type: e.ParameterComponent, options: {midi: [cc, p.encoderRow3[6]], key: "parameter3"}},
                    {type: c.Button, options: {midi: [cc, p.buttonRow1[6]], key: "button_parameter1"}},
                    {type: c.Button, options: {midi: [cc, p.pushEncoderGroup1[6].button], key: "button_parameter2"}},
                ],
            },
            ],
        };
    }
});

/* this statement exists to avoid linter errors */
BCR2000;
