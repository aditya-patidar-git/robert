<!-- e7f1dd6b-623b-46a8-9748-71444df9f246 56c7620d-a083-4663-9219-65b75e809b32 -->
# Update Database Schema to Store Voice with Each Model in Fallback Chain

## Requirements

1. **Update Database Schema to Store Voice with Each Model**

- Change `fallbackChain` in `AIConfig` schema from array of strings to array of objects: `[{modelId, voiceId}, ...]`
- Each entry in the fallback chain should store both model ID and voice ID
- Maintain backward compatibility: handle old format (strings) when reading from database

2. **Update Backend to Handle New Structure**

- Update `aiController.js` to save and retrieve fallback chain as objects with `{modelId, voiceId}`
- Add migration logic to convert old string format to new object format when loading
- Update `modelDiscoveryService.js` to work with new structure (or convert when needed)

3. **Update Frontend to Save Full Objects**

- Remove the logic that extracts only model IDs when saving
- Save the full `{modelId, voiceId}` objects to the database
- Update loading logic to handle both old and new formats from database

## Implementation

**File: `frontend/src/pages/KB/index.jsx`**

1. **Remove "Add Model to Fallback Chain" Dropdown**

- Remove the FormControl containing the "Add Model to Fallback Chain" Select (lines ~1032-1055)
- Remove the `handleAddToFallbackChain` function if it's only used by that dropdown

2. **Update Fallback Chain Data Structure**

- Change `fallbackChain` state from array of strings (model IDs) to array of objects: `[{modelId, voiceId}, ...]`
- Update all places that use `fallbackChain`:
- `handleSaveModelVoice`: store `{modelId: selectedModel, voiceId: selectedVoice}`
- `handleDragEnd`: work with objects instead of strings
- `handleRemoveFromFallbackChain`: work with objects
- `SortableItem`: extract modelId from object
- Visual chain representation: display both model and voice
- `handleSavePrompt`: extract model IDs when saving to database

3. **Update Duplicate Check Logic**

- In `handleSaveModelVoice`, check if the exact `{modelId, voiceId}` combination already exists
- If same model AND same voice: show error "This model and voice combination is already in the fallback chain"
- If same model but different voice: allow adding it

4. **Update Database Save Logic**

- In `handleSavePrompt`, when saving fallback chain to database:
- Save the full `{modelId, voiceId}` objects directly (no extraction of model IDs)
- The backend schema will be updated to accept objects, so send: `fallbackChain: finalFallbackChain` (not extracted IDs)
- Handle both old format (strings) and new format (objects) for backward compatibility when reading

5. **Update UI Display**

- Update `SortableItem` to display both model name and voice name
- Update visual chain representation to show model+voice pairs
- Update the "Add Model to Fallback Chain" dropdown removal (already covered in step 1)

### To-dos

- [x] Verify fallback chain is properly saved to database in updateConfig controller
- [x] Add 'Reset to Default' button next to Auto-generate button with handler
- [x] Remove overlapping 'Select a model to add' text from Select component