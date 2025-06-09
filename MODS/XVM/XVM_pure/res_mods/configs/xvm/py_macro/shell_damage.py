import BigWorld
@xvm.export('shell_damage.shell_damage', deterministic=False)
def shell_damage():
    vehicle = BigWorld.player()
    shotDescr = vehicle.vehicleTypeDescriptor.shot
    if shotDescr.shell.kind == 'HIGH_EXPLOSIVE':
        return "%i" % (shotDescr.shell.damage[0] // 2)
    else:
        return "%i" % (shotDescr.shell.damage[0])