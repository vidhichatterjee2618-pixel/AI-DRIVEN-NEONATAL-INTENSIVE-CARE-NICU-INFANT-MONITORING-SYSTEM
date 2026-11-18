import bpy
import math
import os

# Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Create collection for infant avatar
collection = bpy.data.collections.new("InfantAvatar")
bpy.context.scene.collection.children.link(collection)

# Material: Neutral, professional medical visualization style (soft neonatal skin tone)
skin_mat = bpy.data.materials.new(name="InfantSkinMaterial")
skin_mat.use_nodes = True
nodes = skin_mat.node_tree.nodes
links = skin_mat.node_tree.links

principled = nodes.get("Principled BSDF")
if principled:
    # Soft warm neonatal tone: RGB(0.92, 0.78, 0.71)
    principled.inputs["Base Color"].default_value = (0.91, 0.78, 0.70, 1.0)
    # Roughness: soft medical skin feel
    if "Roughness" in principled.inputs:
        principled.inputs["Roughness"].default_value = 0.45
    # Subsurface / Subsurface Weight if available
    for sub_name in ["Subsurface Weight", "Subsurface"]:
        if sub_name in principled.inputs:
            principled.inputs[sub_name].default_value = 0.25
            break

# Create Armature for skeletal hierarchy
bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = "InfantArmature"
armature = armature_obj.data
armature.name = "InfantSkeleton"

# Clear default bone
bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

# In 3D space:
# Infant lying supine:
# Y is up (Three.js convention, in Blender Z is up).
# We build with Z as up in Blender (standard), and when exporting glTF, Blender automatically converts +Z up to +Y up!
# Longitudinal axis: along Y in Blender.
# Head at +Y, feet at -Y, back on Z=0, chest facing +Z.
# Proportions (Newborn approx 50cm = 0.50m total length):
# Head: 0.12m, Torso: 0.18m, Legs: 0.20m

edit_bones = armature.edit_bones

# 1. Root & Pelvis/Hips
bone_root = edit_bones.new("Root")
bone_root.head = (0, 0, 0.05)
bone_root.tail = (0, 0.04, 0.05)

bone_hips = edit_bones.new("Hips")
bone_hips.head = (0, -0.02, 0.05)
bone_hips.tail = (0, 0.02, 0.05)
bone_hips.parent = bone_root

# 2. Spine & Chest
bone_spine = edit_bones.new("Spine")
bone_spine.head = (0, 0.02, 0.05)
bone_spine.tail = (0, 0.10, 0.06)
bone_spine.parent = bone_hips

bone_chest = edit_bones.new("Chest")
bone_chest.head = (0, 0.10, 0.06)
bone_chest.tail = (0, 0.18, 0.07)
bone_chest.parent = bone_spine

# 3. Neck & Head
bone_neck = edit_bones.new("Neck")
bone_neck.head = (0, 0.18, 0.07)
bone_neck.tail = (0, 0.21, 0.07)
bone_neck.parent = bone_chest

bone_head = edit_bones.new("Head")
bone_head.head = (0, 0.21, 0.07)
bone_head.tail = (0, 0.32, 0.07)
bone_head.parent = bone_neck

# 4. Left Arm (Shoulder -> UpperArm -> Forearm -> Hand)
bone_sh_l = edit_bones.new("Shoulder_L")
bone_sh_l.head = (0.03, 0.16, 0.06)
bone_sh_l.tail = (0.07, 0.16, 0.06)
bone_sh_l.parent = bone_chest

bone_ua_l = edit_bones.new("UpperArm_L")
bone_ua_l.head = (0.07, 0.16, 0.06)
bone_ua_l.tail = (0.12, 0.10, 0.06)
bone_ua_l.parent = bone_sh_l

bone_fa_l = edit_bones.new("Forearm_L")
bone_fa_l.head = (0.12, 0.10, 0.06)
bone_fa_l.tail = (0.10, 0.04, 0.08)
bone_fa_l.parent = bone_ua_l

bone_hand_l = edit_bones.new("Hand_L")
bone_hand_l.head = (0.10, 0.04, 0.08)
bone_hand_l.tail = (0.09, 0.01, 0.08)
bone_hand_l.parent = bone_fa_l

# 5. Right Arm (Shoulder -> UpperArm -> Forearm -> Hand)
bone_sh_r = edit_bones.new("Shoulder_R")
bone_sh_r.head = (-0.03, 0.16, 0.06)
bone_sh_r.tail = (-0.07, 0.16, 0.06)
bone_sh_r.parent = bone_chest

bone_ua_r = edit_bones.new("UpperArm_R")
bone_ua_r.head = (-0.07, 0.16, 0.06)
bone_ua_r.tail = (-0.12, 0.10, 0.06)
bone_ua_r.parent = bone_sh_r

bone_fa_r = edit_bones.new("Forearm_R")
bone_fa_r.head = (-0.12, 0.10, 0.06)
bone_fa_r.tail = (-0.10, 0.04, 0.08)
bone_fa_r.parent = bone_ua_r

bone_hand_r = edit_bones.new("Hand_R")
bone_hand_r.head = (-0.10, 0.04, 0.08)
bone_hand_r.tail = (-0.09, 0.01, 0.08)
bone_hand_r.parent = bone_fa_r

# 6. Left Leg (Thigh -> Shin -> Foot)
bone_th_l = edit_bones.new("UpperLeg_L")
bone_th_l.head = (0.05, -0.02, 0.05)
bone_th_l.tail = (0.08, -0.10, 0.07)
bone_th_l.parent = bone_hips

bone_shn_l = edit_bones.new("LowerLeg_L")
bone_shn_l.head = (0.08, -0.10, 0.07)
bone_shn_l.tail = (0.07, -0.17, 0.05)
bone_shn_l.parent = bone_th_l

bone_ft_l = edit_bones.new("Foot_L")
bone_ft_l.head = (0.07, -0.17, 0.05)
bone_ft_l.tail = (0.07, -0.21, 0.07)
bone_ft_l.parent = bone_shn_l

# 7. Right Leg (Thigh -> Shin -> Foot)
bone_th_r = edit_bones.new("UpperLeg_R")
bone_th_r.head = (-0.05, -0.02, 0.05)
bone_th_r.tail = (-0.08, -0.10, 0.07)
bone_th_r.parent = bone_hips

bone_shn_r = edit_bones.new("LowerLeg_R")
bone_shn_r.head = (-0.08, -0.10, 0.07)
bone_shn_r.tail = (-0.07, -0.17, 0.05)
bone_shn_r.parent = bone_th_r

bone_ft_r = edit_bones.new("Foot_R")
bone_ft_r.head = (-0.07, -0.17, 0.05)
bone_ft_r.tail = (-0.07, -0.21, 0.07)
bone_ft_r.parent = bone_shn_r

bpy.ops.object.mode_set(mode='OBJECT')

# Helper to create smooth mesh primitives
def create_mesh_part(name, mesh_type, location, scale, rotation=(0,0,0), parent_bone=""):
    if mesh_type == 'SPHERE':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0, location=location, rotation=rotation)
    elif mesh_type == 'CYLINDER':
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1.0, depth=2.0, location=location, rotation=rotation)
    
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    if obj.data.materials:
        obj.data.materials[0] = skin_mat
    else:
        obj.data.materials.append(skin_mat)
    
    # Assign vertex group for bone weight
    if parent_bone:
        vg = obj.vertex_groups.new(name=parent_bone)
        all_indices = [v.index for v in obj.data.vertices]
        vg.add(all_indices, 1.0, 'REPLACE')
    
    return obj

created_parts = []

# Head (Neonatal cranial vault: slightly elongated, round cheeks, soft face)
head_obj = create_mesh_part("Infant_Head", 'SPHERE', (0, 0.26, 0.07), (0.058, 0.068, 0.062), parent_bone="Head")
created_parts.append(head_obj)

# Neck
neck_obj = create_mesh_part("Infant_Neck", 'CYLINDER', (0, 0.195, 0.065), (0.032, 0.032, 0.02), parent_bone="Neck")
created_parts.append(neck_obj)

# Chest / Torso (Rounded newborn ribcage & abdomen)
chest_obj = create_mesh_part("Infant_Chest", 'SPHERE', (0, 0.14, 0.065), (0.065, 0.055, 0.052), parent_bone="Chest")
created_parts.append(chest_obj)

abdomen_obj = create_mesh_part("Infant_Abdomen", 'SPHERE', (0, 0.06, 0.058), (0.062, 0.052, 0.050), parent_bone="Spine")
created_parts.append(abdomen_obj)

pelvis_obj = create_mesh_part("Infant_Pelvis", 'SPHERE', (0, 0.00, 0.052), (0.058, 0.045, 0.046), parent_bone="Hips")
created_parts.append(pelvis_obj)

# Limbs (gently flexed neonatal posture)
# Left Arm
sh_l_obj = create_mesh_part("Infant_Shoulder_L", 'SPHERE', (0.06, 0.16, 0.06), (0.022, 0.022, 0.022), parent_bone="Shoulder_L")
ua_l_obj = create_mesh_part("Infant_UpperArm_L", 'CYLINDER', (0.095, 0.13, 0.06), (0.019, 0.019, 0.035), rotation=(0.3, 0.5, 0), parent_bone="UpperArm_L")
fa_l_obj = create_mesh_part("Infant_Forearm_L", 'CYLINDER', (0.11, 0.07, 0.07), (0.016, 0.016, 0.032), rotation=(0.8, -0.3, 0), parent_bone="Forearm_L")
hd_l_obj = create_mesh_part("Infant_Hand_L", 'SPHERE', (0.095, 0.025, 0.08), (0.018, 0.018, 0.014), parent_bone="Hand_L")
created_parts.extend([sh_l_obj, ua_l_obj, fa_l_obj, hd_l_obj])

# Right Arm
sh_r_obj = create_mesh_part("Infant_Shoulder_R", 'SPHERE', (-0.06, 0.16, 0.06), (0.022, 0.022, 0.022), parent_bone="Shoulder_R")
ua_r_obj = create_mesh_part("Infant_UpperArm_R", 'CYLINDER', (-0.095, 0.13, 0.06), (0.019, 0.019, 0.035), rotation=(0.3, -0.5, 0), parent_bone="UpperArm_R")
fa_r_obj = create_mesh_part("Infant_Forearm_R", 'CYLINDER', (-0.11, 0.07, 0.07), (0.016, 0.016, 0.032), rotation=(0.8, 0.3, 0), parent_bone="Forearm_R")
hd_r_obj = create_mesh_part("Infant_Hand_R", 'SPHERE', (-0.095, 0.025, 0.08), (0.018, 0.018, 0.014), parent_bone="Hand_R")
created_parts.extend([sh_r_obj, ua_r_obj, fa_r_obj, hd_r_obj])

# Left Leg
th_l_obj = create_mesh_part("Infant_UpperLeg_L", 'CYLINDER', (0.065, -0.06, 0.06), (0.024, 0.024, 0.042), rotation=(-0.4, 0.3, 0), parent_bone="UpperLeg_L")
shn_l_obj = create_mesh_part("Infant_LowerLeg_L", 'CYLINDER', (0.075, -0.135, 0.06), (0.020, 0.020, 0.038), rotation=(0.3, -0.1, 0), parent_bone="LowerLeg_L")
ft_l_obj = create_mesh_part("Infant_Foot_L", 'SPHERE', (0.07, -0.19, 0.06), (0.018, 0.028, 0.015), parent_bone="Foot_L")
created_parts.extend([th_l_obj, shn_l_obj, ft_l_obj])

# Right Leg
th_r_obj = create_mesh_part("Infant_UpperLeg_R", 'CYLINDER', (-0.065, -0.06, 0.06), (0.024, 0.024, 0.042), rotation=(-0.4, -0.3, 0), parent_bone="UpperLeg_R")
shn_r_obj = create_mesh_part("Infant_LowerLeg_R", 'CYLINDER', (-0.075, -0.135, 0.06), (0.020, 0.020, 0.038), rotation=(0.3, 0.1, 0), parent_bone="LowerLeg_R")
ft_r_obj = create_mesh_part("Infant_Foot_R", 'SPHERE', (-0.07, -0.19, 0.06), (0.018, 0.028, 0.015), parent_bone="Foot_R")
created_parts.extend([th_r_obj, shn_r_obj, ft_r_obj])

# Join meshes into a single skin with armature modifier, keeping named vertex groups
# Select all parts
bpy.ops.object.select_all(action='DESELECT')
for p in created_parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = created_parts[0]
bpy.ops.object.join()

infant_mesh_obj = bpy.context.active_object
infant_mesh_obj.name = "Infant_Body_Mesh"

# Add Armature Modifier
mod = infant_mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
mod.object = armature_obj
mod.use_vertex_groups = True

# Parent mesh to armature
infant_mesh_obj.parent = armature_obj

# Setup clean lighting in Blender
light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
light_data.energy = 2.5
light_obj = bpy.data.objects.new(name="KeyLight", object_data=light_data)
light_obj.location = (2, 2, 4)
collection.objects.link(light_obj)

# Create an Incubator Mattress base for clinical context
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.05, -0.01))
mattress_obj = bpy.context.active_object
mattress_obj.name = "Incubator_Mattress"
mattress_obj.scale = (0.35, 0.65, 0.04)
mattress_mat = bpy.data.materials.new(name="MattressMaterial")
mattress_mat.use_nodes = True
mat_principled = mattress_mat.node_tree.nodes.get("Principled BSDF")
if mat_principled:
    mat_principled.inputs["Base Color"].default_value = (0.85, 0.90, 0.93, 1.0) # clinical medical pale blue
mattress_obj.data.materials.append(mattress_mat)

# Export paths
output_dir = r"C:\Users\HP\.gemini\antigravity\scratch\NICU_3D_Visualization\public\models"
os.makedirs(output_dir, exist_ok=True)
blend_path = os.path.join(output_dir, "infant_avatar.blend")
glb_path = os.path.join(output_dir, "infant_avatar.glb")

# Save .blend file
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Saved Blender file to: {blend_path}")

# Export GLTF / GLB with armature and skinning
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    export_yup=True
)
print(f"Exported GLB model to: {glb_path}")
