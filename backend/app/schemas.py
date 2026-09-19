from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class ProyectoBase(BaseModel):
    id: Optional[int] = None
    nombre: str
    sinonimos: Optional[str] = None

class ProyectoResponse(ProyectoBase):
    model_config = ConfigDict(from_attributes=True)

class RegistroMaestroBase(BaseModel):
    idd: int
    sondaje: Optional[str] = None
    codigo_muestra: Optional[str] = None
    laboratorio: Optional[str] = None
    dia: Optional[int] = None # Nuevo campo
    mes: Optional[str] = None
    anio: Optional[int] = None
    proyecto: Optional[str] = None
    desde: Optional[float] = None
    hasta: Optional[float] = None
    longitud_muestra: Optional[float] = None
    este: Optional[float] = None
    norte: Optional[float] = None
    elevacion: Optional[float] = None
    sectores: Optional[str] = None
    lito1: Optional[str] = None
    lito2: Optional[str] = None
    lito3: Optional[str] = None
    tipo_ensayo: Optional[str] = None
    
    # UCS
    ucs_diametro: Optional[float] = None
    ucs_carga_rotura: Optional[float] = None
    ucs_resistencia: Optional[float] = None
    ucs_resistencia_calculada: Optional[float] = None
    ucs_rotura: Optional[str] = None
    
    # Constantes Elásticas
    elasticas_modulo_young: Optional[float] = None
    elasticas_poisson: Optional[float] = None
    
    # Tracción Indirecta
    traccion_carga_promedio: Optional[float] = None
    traccion_resistencia_kgcm2: Optional[float] = None
    traccion_vacia_28: Optional[str] = None
    traccion_resistencia_mpa: Optional[float] = None
    
    # Corte Directo
    corte_tipo_fractura: Optional[str] = None
    corte_area: Optional[float] = None
    corte_esf_normal_kpa: Optional[float] = None
    corte_esf_corte_kpa: Optional[float] = None
    corte_esf_normal_mpa: Optional[float] = None
    corte_esf_corte_mpa: Optional[float] = None
    corte_cohesion_mpa: Optional[float] = None
    corte_angulo_friccion: Optional[float] = None
    
    # Compresión Triaxial
    triaxial_carga_confinamiento: Optional[float] = None
    triaxial_esfuerzo_maximo: Optional[float] = None
    triaxial_resistencia_mpa: Optional[float] = None
    triaxial_mi: Optional[float] = None
    triaxial_cohesion_mpa: Optional[float] = None
    triaxial_angulo_friccion: Optional[float] = None
    triaxial_rotura: Optional[str] = None
    
    # Propiedades Físicas
    prop_peso_unitario_geometrico: Optional[float] = None
    
    # Comentarios y campaña
    observacion: Optional[str] = None
    campana: Optional[str] = None

class RegistroMaestroCreate(RegistroMaestroBase):
    pass

class RegistroMaestroUpdate(BaseModel):
    sondaje: Optional[str] = None
    codigo_muestra: Optional[str] = None
    laboratorio: Optional[str] = None
    dia: Optional[int] = None
    mes: Optional[str] = None
    anio: Optional[int] = None
    proyecto: Optional[str] = None
    desde: Optional[float] = None
    hasta: Optional[float] = None
    longitud_muestra: Optional[float] = None
    este: Optional[float] = None
    norte: Optional[float] = None
    elevacion: Optional[float] = None
    sectores: Optional[str] = None
    lito1: Optional[str] = None
    lito2: Optional[str] = None
    lito3: Optional[str] = None
    tipo_ensayo: Optional[str] = None
    
    ucs_diametro: Optional[float] = None
    ucs_carga_rotura: Optional[float] = None
    ucs_resistencia: Optional[float] = None
    ucs_resistencia_calculada: Optional[float] = None
    ucs_rotura: Optional[str] = None
    
    elasticas_modulo_young: Optional[float] = None
    elasticas_poisson: Optional[float] = None
    
    traccion_carga_promedio: Optional[float] = None
    traccion_resistencia_kgcm2: Optional[float] = None
    traccion_vacia_28: Optional[str] = None
    traccion_resistencia_mpa: Optional[float] = None
    
    corte_tipo_fractura: Optional[str] = None
    corte_area: Optional[float] = None
    corte_esf_normal_kpa: Optional[float] = None
    corte_esf_corte_kpa: Optional[float] = None
    corte_esf_normal_mpa: Optional[float] = None
    corte_esf_corte_mpa: Optional[float] = None
    corte_cohesion_mpa: Optional[float] = None
    corte_angulo_friccion: Optional[float] = None
    
    triaxial_carga_confinamiento: Optional[float] = None
    triaxial_esfuerzo_maximo: Optional[float] = None
    triaxial_resistencia_mpa: Optional[float] = None
    triaxial_mi: Optional[float] = None
    triaxial_cohesion_mpa: Optional[float] = None
    triaxial_angulo_friccion: Optional[float] = None
    triaxial_rotura: Optional[str] = None
    
    prop_peso_unitario_geometrico: Optional[float] = None
    
    observacion: Optional[str] = None
    campana: Optional[str] = None

class RegistroMaestroResponse(RegistroMaestroBase):
    model_config = ConfigDict(from_attributes=True)