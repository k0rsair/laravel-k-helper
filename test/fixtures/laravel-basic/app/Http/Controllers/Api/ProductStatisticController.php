<?php

namespace App\Http\Controllers\Api;

class ProductStatisticController
{
    public function index()
    {
        return response()->json([]);
    }

    public function store()
    {
        return response()->json([
            'id' => 1,
            'name' => 'Created product statistic',
            'meta' => [
                'source' => 'api',
            ],
        ]);
    }

    public function show($productStatistic)
    {
        return response()->json([]);
    }

    public function update($productStatistic)
    {
        return [
            'id' => $productStatistic,
            'updated' => true,
            'product' => [
                'id' => 10,
                'name' => 'Phone',
            ],
        ];
    }

    public function destroy($productStatistic)
    {
        return response()->json([]);
    }
}
