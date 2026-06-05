<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\LabelsController;
use Inertia\Inertia;

Route::get('/', fn () => view('welcome'))->name('home');
Route::get('/users', [UserController::class, 'index'])->name('users.index');
Route::post('/users', [UserController::class, 'store'])->name('users.store');
Route::get('/spa/users', fn () => Inertia::render('Users/Index', [
    'users' => [],
    'filters' => [
        'search' => '',
    ],
]))->name('users.spa');
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', fn () => view('welcome'))->name('dashboard');
});

Route::group(['prefix' => 'labels', 'controller' => \App\Http\Controllers\Api\LabelsController::class], function () {
    Route::get('{projectDelivery}/{article}', 'getLabel');
    Route::post('{projectDelivery}/{article}', 'storeLabel');
});

Route::group(['prefix' => 'imported-labels', 'controller' => LabelsController::class], function () {
    Route::get('{label}', 'importedLabel');
});

Route::prefix('chained-labels')->controller(LabelsController::class)->group(function () {
    Route::get('{label}', 'chainedLabel');
});

Route::group(['prefix' => 'nested-labels', 'controller' => LabelsController::class], function () {
    Route::prefix('archive')->group(function () {
        Route::get('{label}', 'nestedLabel');
    });
});

Route::get('/array-labels/{label}', [LabelsController::class, 'arrayLabel']);
Route::get('/legacy-labels/{label}', 'LabelsController@legacyLabel');
Route::get('/invokable-labels/{label}', LabelsController::class)->middleware('project.active');
