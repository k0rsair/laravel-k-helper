<?php

namespace App\Filament\Resources;

class UserResource
{
    public static function form($form)
    {
        return $form->schema([
            TextInput::make('name'),
            Toggle::make('is_active'),
        ]);
    }

    public static function table($table)
    {
        return $table
            ->columns([
                TextColumn::make('email'),
            ])
            ->actions([
                Action::make('archive'),
            ]);
    }
}
