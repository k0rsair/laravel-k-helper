<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['ok' => true])->name('api.health');
Route::post('/orders/{order}/cancel', fn (string $order) => ['cancelled' => $order])->name('api.orders.cancel');

Route::prefix('v1')->group(function () {
    Route::patch('/profiles/{profile}', fn (string $profile) => ['profile' => $profile])->name('api.profiles.update');
});
