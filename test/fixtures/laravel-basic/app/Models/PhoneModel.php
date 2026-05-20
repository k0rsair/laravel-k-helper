<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class PhoneModel extends BaseModel
{
    public function workpieces(): HasMany
    {
        return $this->hasMany(Workpiece::class, 'phone_model_id');
    }

    public function scopeActive($query)
    {
        return $query;
    }
}
