<?php

namespace App\Providers\Filament;

use App\Filament\Resources\UserResource;

class AdminPanelProvider
{
    public function panel($panel)
    {
        return $panel->resources([
            UserResource::class,
        ]);
    }
}
