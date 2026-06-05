<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductStatisticController;
use App\Http\Resources\UserSummaryCollection;
use App\Http\Resources\UserSummaryResource;
use App\Models\User;

Route::get('/health', fn () => ['ok' => true, 'status' => ['name' => 'ready']])->name('api.health');
Route::post('/orders/{order}/cancel', fn (string $order) => ['cancelled' => true, 'order' => ['id' => $order]])->name('api.orders.cancel');
Route::post('/dop-product-statistic/{product}/{group}', fn (string $product, string $group) => ['product' => $product, 'group' => $group])->name('api.dop-product-statistic');
Route::get('/users/{user}/summary', fn (User $user) => collect([
    'user' => $user,
    'statusArray' => StatusProductEnum::getAll(),
]))->name('api.users.summary');
Route::get('/users/{user}/resource-summary', fn (User $user) => UserSummaryResource::make($user))->name('api.users.resource-summary');
Route::get('/users/{user}/resource-payload', fn (User $user) => [
    'user' => new UserSummaryResource($user),
    'relatedUsers' => UserSummaryResource::collection(collect([$user])),
])->name('api.users.resource-payload');
Route::get('/users/{user}/resource-collection', fn (User $user) => new UserSummaryCollection(collect([$user])))->name('api.users.resource-collection');
Route::apiResource('/product-statistics', ProductStatisticController::class);

Route::prefix('v1')->group(function () {
    Route::patch('/profiles/{profile}', fn (string $profile) => ['profile' => $profile])->name('api.profiles.update');
});
