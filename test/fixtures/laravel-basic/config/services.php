<?php

return [
    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'endpoint' => [
            'region' => [
                'name' => env('MAILGUN_REGION', 'us'),
            ],
        ],
    ],
    'marketplaces' => [
        'ozon' => [
            36 => [
                'warehouse' => [
                    'name' => env('OZON_WAREHOUSE_NAME'),
                ],
            ],
        ],
    ],
];
