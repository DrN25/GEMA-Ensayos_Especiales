from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.sample_validation import _affects_core, validate_sample_interval, resolve_borehole


def row(start, end, kind='F'):
    return dict(desde=Decimal(start), hasta=Decimal(end), tipo=kind, lito1='MZM', lito2=None, lito3=None)


@pytest.mark.parametrize('start,end,invalid', [
    ('0.99','1.05',False), ('1.95','2.1',False),
    ('1.00','1.050001',True), ('1.949999','2.00',True),
    ('1.4','1.5',True), ('0.8','2.2',True),
    ('0.8','1.0',False), ('2.0','2.1',False),
])
def test_five_centimeter_edges_are_inclusive_but_not_the_core(start,end,invalid):
    assert _affects_core(row(start,end), Decimal('1'), Decimal('2')) == invalid


class Database:
    def __init__(self, structures):
        self.structures = structures
    def execute(self, query, params):
        return SimpleNamespace(mappings=lambda:SimpleNamespace(all=lambda:self.structures))


def test_validation_reports_tolerated_and_blocking_fractures():
    result=validate_sample_interval(Database([row('1','1.05'),row('1.05','1.95','SE'),row('1.95','2')]),1,Decimal('1'),Decimal('2'),'UCS')
    assert result['valida']
    assert result['fracturas']==0
    assert result['fracturas_totales']==result['fracturas_toleradas']==2
    assert result['litologia']=='MZM'
    result=validate_sample_interval(Database([row('1','1.06')]),1,Decimal('1'),Decimal('2'),'TX')
    assert not result['valida'] and result['fracturas']==1


def test_missing_type_and_missing_logging_are_not_accepted_as_se():
    result=validate_sample_interval(Database([row('1','1.02',None)]),1,Decimal('1'),Decimal('2'),'TI')
    assert result['motivo']=='tipo_desconocido'
    result=validate_sample_interval(Database([]),None,Decimal('1'),Decimal('2'),'UCS')
    assert result['motivo']=='sin_registros'
    result=validate_sample_interval(Database([]),None,Decimal('1'),Decimal('2'),'CD')
    assert result['valida']


def test_short_sample_has_no_core_but_still_requires_known_structure():
    assert not _affects_core(row('1','1.1'),Decimal('1'),Decimal('1.1'))
    assert validate_sample_interval(Database([row('1','1.1')]),1,Decimal('1'),Decimal('1.1'),'CE')['valida']


def test_custom_borehole_resolution_does_not_insert_anything():
    calls=[]
    def execute(query,params):
        calls.append(str(query))
        return SimpleNamespace(mappings=lambda:SimpleNamespace(first=lambda:None))
    assert resolve_borehole(SimpleNamespace(execute=execute),None,' NEW-001 ') == (None,'NEW-001')
    assert len(calls)==1 and calls[0].startswith('SELECT')


def test_custom_borehole_save_uses_master_code_without_creating_a_borehole():
    from app.services.assay_registration import AssayRegistration, register_assay
    values = dict(sondaje_codigo='NEW-001', numero_muestra='M01', proyecto='FRBB', ensayo='CD',
                  laboratorio='Geomec', desde='1',hasta='2',mes='Enero',anio=2026,
                  este='123456.00',norte='1234567.00',elevacion='1234.00',mediciones=[{}])
    payload=AssayRegistration(**values)
    statements=[]
    saved=[]
    def execute(query,params=None):
        statements.append(str(query))
        return SimpleNamespace(mappings=lambda:SimpleNamespace(first=lambda:None,all=lambda:[]),scalar_one=lambda:0)
    db=SimpleNamespace(execute=execute,get_bind=lambda:SimpleNamespace(dialect=SimpleNamespace(name='mssql')),
                       add_all=lambda rows:saved.extend(rows),commit=lambda:None,rollback=lambda:None)
    result=register_assay(payload,db)
    assert result['codigo_muestra']=='NEW-001-CD-M01'
    assert saved[0].sondaje=='NEW-001'
    assert all('INSERT' not in sql for sql in statements)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        register_assay(AssayRegistration(**{**values,'ensayo':'UCS'}),db)
    assert error.value.status_code==422
    assert len(saved)==1
