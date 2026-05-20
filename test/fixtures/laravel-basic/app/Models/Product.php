<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Product extends Model
{
    public function phoneModel(): HasOne
    {
        return $this->hasOne(PhoneModel::class, 'article', 'phone_articul');
    }

    public function scopeReady($query)
    {
        return $query;
    }
}
