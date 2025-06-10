# Available macroses / Доступные макросы

Warning: don't copy macroses with ` symbol, only what's inside!
Внимание: не копируйте макросы с символом `, а только то что внутри!

## Aiming info template / Шаблон информации про сведение танка

- `%(aimingRemainingTime)s` - remaining aiming time | оставшееся время до полного сведения
- `%(c:aimingStatus)s` - color depending on status (not ready, almost ready, ready) | цвет в зависимости от готовности (не готов, почти и готов)
- `%(aimingProgress)s` - aiming progress in percents | прогресс сведения в процентах

## Health info template / Шаблон информации про состояние прочности танка

- `%(health)s` - current player's vehicle HP level | текущий уровень ХП техники игрока
- `%(c:health)s` - color depending of current player's vehicle HP level | цвет в зависимости от текущего уровня ХП игрока
- `%(maxHealth)s` - max player's vehicle HP level including all factors (improved hardening, field modernization, etc.) | максимальный уровень ХП с учётом всех факторов (улучшенная закалка, полевая модернизация и прочее) техники игрока
- `%(healthPercentage)s` - current player's vehicle HP percentage | текущее значение прочности техники игрока в процентах

## Shell info template / Шаблон информации про текущий снаряд танка

- `%(shellDamage)s` - current loaded shell damage | урон заряженного снаряда
- `%(shellDamageDispersion)s` - current loaded shell damage dispersion | разброс урона заряженного снаряда (с учётом +-25%)
- `%(shellPenetration)s` - current loaded shell penetration | пробитие заряженного снаряда
- `%(shellPenetrationDispersion)s` - current shell penetration with +-25% dispersion | разброс пробития заряженного снаряда (с учётом +-25%)
- `%(shellType)s` - current shell type | текущий тип заряженного снаряда
- `%(shellKind)s` - current shell kind (normal, premium or stun) | текущий тип заряженного снаряда (обычный, премиум или станящий)
- `%(c:shellKind)s` - current shell type color (normal, premium or stun) | цвет текущего типа заряженного снаряда (обычный, премиум или станящий)
- `%(shellSpeed)s` - current shell speed | скорость полёта заряженного снаряда
- `%(shellCaliber)s` - current shell caliber | калибр заряженного снаряда
- `%(gunElevation)s` - gun elevation | максимальный верхний угол вертикальной наводки танка
- `%(gunDepression)s` - gun depression | максимальный нижний угол вертикальной наводки танка
- `%(gunPitchLimits)s` - gun elevation and depression | углы вертикальной наводки танка