import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Stack, TextField, FormControl, InputLabel, Select, MenuItem, Button, DialogActions } from '@mui/material';

const PhoneNumberForm = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: initialData || {
      number: '',
      route: 'ai_agent',
      status: 'active',
      description: ''
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3} sx={{ mt: 1 }}>
        <Controller
          name="number"
          control={control}
          rules={{
            required: 'Phone number is required',
            pattern: {
              value: /^\+?[1-9]\d{1,14}$/,
              message: 'Enter a valid phone number in E.164 format (e.g., +442045726060)'
            }
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Phone Number"
              fullWidth
              placeholder="+442045726060"
              error={!!error}
              helperText={error?.message || 'Enter phone number in E.164 format'}
            />
          )}
        />
        <Controller
          name="route"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Route Assignment</InputLabel>
              <Select {...field} label="Route Assignment">
                <MenuItem value="ai_agent">AI Agent</MenuItem>
                <MenuItem value="transfer">Transfer to Human</MenuItem>
                <MenuItem value="voicemail">Voicemail</MenuItem>
                <MenuItem value="after_hours">After-hours Message</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select {...field} label="Status">
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Description"
              fullWidth
              multiline
              rows={2}
              helperText="Optional description for this phone number"
            />
          )}
        />
      </Stack>
      <DialogActions sx={{ mt: 3 }}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </form>
  );
};

export default PhoneNumberForm;



