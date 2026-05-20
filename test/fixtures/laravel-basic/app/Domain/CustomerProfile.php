<?php

namespace App\Domain;

use App\Models\BaseModel;

class CustomerProfile extends BaseModel
{
    protected $table = 'users';

    protected $fillable = [
        'name',
    ];
}
