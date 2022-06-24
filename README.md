# mixxx-controllers

Custom controller mappings for [Mixxx](https://mixxx.org/).

## Contents
### Behringer DDM4000
This custom mapping allows to control
* 2 Decks
* Loop, Reverse, Quick Effect and Key controls for 2 Decks
* 1 Effect Unit incl. a custom Echo Out effect
* Crossfader
* Sampler except _MIX_ knob and _INSERT_ button

See the [PDF manual](manual/pdf/Behringer%20DDM4000.pdf) for details.

For reference: the default mapping allows to control 4 Decks, Microphone, Crossfader and Sampler.

### Behringer BCR2000
This custom mapping allows to control full controls for 2 Effect Units, i.e. 12 knobs and 9 buttons per Effect Unit.

See the [PDF manual](manual/pdf/Behringer%20BCR2000.pdf) for details.

For reference: the default mapping allows to control
* Loop, Reverse and Key controls for 2 Decks
* Standard controls for 2 Effect Units, i.e. 3 buttons and 3 knobs per Effect Unit

Both mappings are conform to the [Standard Effects Mapping](https://github.com/mixxxdj/mixxx/wiki/Standard%20Effects%20Mapping).

## How to use the mappings
1. Copy the contents of the directory `mixxx/res/controllers` into a `controllers` directory in the [Mixxx Settings Directory](https://manual.mixxx.org/latest/en/chapters/appendix/settings_directory.html).
1. Enable your controller(s) and assign the custom mappings as described in [Using MIDI/HID Controllers](https://manual.mixxx.org/latest/en/chapters/controlling_mixxx.html#control-midi).

## How to build the manuals
1. Follow the [instructions](https://github.com/mixxxdj/manual/#getting-started) to setup the Mixxx Manual in a local directory.
1. Copy the content of the `source/manual` directory into the local directory.
1. Follow the [instructions](https://github.com/mixxxdj/manual/#editing-the-manual-using-git-recommended) to build the manual.
