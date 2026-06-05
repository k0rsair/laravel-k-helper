<?php

namespace App\Filament\Resources\UserResource\Pages;

class ListUsers
{
    public static function table($table)
    {
        return $table->actions([
            Action::make('restore'),
        ]);
    }
}
