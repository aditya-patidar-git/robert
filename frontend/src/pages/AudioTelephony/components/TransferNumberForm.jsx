import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Stack, TextField, Button, DialogActions, FormControlLabel, Switch } from '@mui/material';

const TransferNumberForm = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: initialData || {
      number: '',
      name: '',
      department: '',
      isActive: true
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
              message: 'Enter a valid phone number in E.164 format'
            }
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Phone Number"
              fullWidth
              placeholder="+442036918807"
              error={!!error}
              helperText={error?.message || 'Enter phone number in E.164 format'}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              fullWidth
              placeholder="Main Office"
              helperText="Optional name for this transfer number"
            />
          )}
        />
        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Department"
              fullWidth
              placeholder="Customer Service"
              helperText="Optional department name"
            />
          )}
        />
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch {...field} checked={field.value} />}
              label="Active"
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

export default TransferNumberForm;



