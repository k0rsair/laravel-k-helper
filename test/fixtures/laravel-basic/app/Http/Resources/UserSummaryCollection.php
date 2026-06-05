<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class UserSummaryCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => UserSummaryResource::collection($this->collection),
            'meta' => [
                'count' => $this->collection->count(),
            ],
        ];
    }
}
