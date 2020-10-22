This module provides a means to automate the spreading of fires or other similar environmental hazards. Fires, strange oozes, fungal growth, millions of tiny spiders, lava, whatever you can imagine!

## Usage
For basic usage, first create a Token that will represent a "fire" or other spreading entity. Give the Token an appropraite image, lighting effects, size, etc. You may want to give it HP or other statistics based on the system in use, and your intent for how players will deal with it.

Once you have a representative Token, you will need to designate areas that are "flammable" - places that this thing are allowed to spread to. You may want to designate a single wooden building, or perhaps the entire map is being slowly engulfed in lava. Either way, this is done by using the drawing tool to create rectangular ares in the scene. Once you create these rectangles, you may adjust their apperance as you see fit, and choose whether they are visible to players. Then select all such areas, and click the newly added button on the control pallet with the tree icon. This will mark the selected drawings as "flammable."

Now that you have a fire, and you have some place it can spread to, you can prepare the combat tracker. You can do this ahead of time, or in the moment - simply select the Token which represnts the "fire" and then click the new flame icon button to the left of the "Round #" label in the tracker. This will add a new combatant with the name of the Token - however, you have *not* added the Token ot its Actor to the combat! Instead, this new combatant controls the spreading of the wildfire throughout the scene.

Each round of combat, when the fire takes its turn, each instance of the fire will try to spread into adjacent spaces. Spreading is limited by flammable areas, and optionally can be randomized by setting a roll formula and target. For each adjacent space, a roll will be made, and the fire will spread if the result is equal to or greater than the target.

The formula and target can be adjusted through the "Update Combatant" sheet.

Please note that only the initial Token, and duplicates made of it *after* being added to the tracker are registered as parts of the fire. Other Tokens based on the same Actor will not count. Once added however, you can make copies of the Token to other locations.