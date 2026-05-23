<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductStatisticController;

Route::get('/health', fn () => ['ok' => true])->name('api.health');
Route::post('/orders/{order}/cancel', fn (string $order) => ['cancelled' => $order])->name('api.orders.cancel');
Route::post('/dop-product-statistic/{product}/{group}', fn (string $product, string $group) => ['product' => $product, 'group' => $group])->name('api.dop-product-statistic');
Route::apiResource('/product-statistics', ProductStatisticController::class);

Route::prefix('v1')->group(function () {
    Route::patch('/profiles/{profile}', fn (string $profile) => ['profile' => $profile])->name('api.profiles.update');
});
