// Form definitions - sections & items taken verbatim from the IPS Word templates (src/*.py)
const TRAILER_TYPES = ["Flat-deck","Skeletal","Curtain-side","Closed body","Step-deck","Other"];
const OKDEF = ["OK","Defect","N/A"], YESNO = ["Yes","No","N/A"];
const FORMS = {
 rw: {
  id:"rw", title:"Pre-Load Roadworthiness Check", short:"Roadworthiness",
  subtitle:"Vehicle visual inspection of truck & trailer by the IPS loadmaster, before loading",
  notice:{cls:"warn", html:"<b>IMPORTANT: THIS IS NOT A ROADWORTHY CERTIFICATE.</b> It records a visual, walk-around pre-load check only. Only a registered vehicle testing station can issue a certificate of roadworthiness. The vehicle owner, operator and driver remain responsible for the vehicle's roadworthiness. Items marked <b>(GP)</b> are general good practice, not a statement of a legal requirement."},
  sections:[
   {k:"s1", title:"1. Vehicle & trailer details", photos:true, fields:[
     {t:"text",k:"rep",label:"REP no.",ro:true},{t:"text",k:"datetime",label:"Date / time",ro:true},
     {t:"text",k:"location",label:"Location / area",req:true},{t:"text",k:"loadmaster",label:"Loadmaster",req:true},
     {t:"text",k:"truck_reg",label:"Truck reg.",req:true,upper:true},{t:"text",k:"trailer_reg1",label:"Trailer reg. (1)",upper:true},
     {t:"text",k:"truck_make",label:"Truck make / model"},{t:"text",k:"trailer_reg2",label:"Trailer reg. (2)",upper:true},
     {t:"text",k:"driver",label:"Driver name",req:true},{t:"text",k:"transporter",label:"Transporter / operator"},
     {t:"choice",k:"trailer_type",label:"Trailer type",opts:TRAILER_TYPES,other:true,req:true},
     {t:"text",k:"linked_rep",label:"Linked Load Securing Checklist (REP no.)",ro:true},
     {t:"text",k:"odometer",label:"Odometer (km)",type:"number"}]},
   {k:"s2",title:"2. Documents (sighted)",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Valid vehicle licence disc displayed on the truck, not expired",
    "Valid vehicle licence disc on each trailer, not expired",
    "Operator card displayed, where required for the vehicle",
    "Driver's licence valid and of the correct code for the vehicle combination",
    "Professional driving permit (PrDP) valid",
    "Cross-border permit and documents, if the trip is cross-border"]}]},
   {k:"s3",title:"3. Tyres (truck & trailer)",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Tread depth at least 1 mm across the tread on every tyre; no exposed cords",
    "No cuts, bulges, sidewall damage or separation; wheel nuts all present",
    "Tyres look correctly inflated; no flat or visibly soft tyres (GP: check with gauge)",
    "Dual tyres matched in size and type; no stones or debris between duals (GP)"]}]},
   {k:"s4",title:"4. Lights & reflectors",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Headlights (dipped and main beam) working","Brake lights working (truck and trailer)",
    "Indicators and hazard lights working, front, side and rear",
    "Tail lights, side marker lights and reflectors present and clean",
    "Rear reflective chevron / conspicuity tape fitted, clean and not damaged"]}]},
   {k:"s5",title:"5. Brakes",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "No audible air leaks with the system charged and engine off (GP)",
    "Air hoses and electrical cables not chafed, kinked or damaged; couplings secure and sealing",
    "Handbrake / parking brake applies and holds the vehicle"]}]},
   {k:"s6",title:"6. Coupling",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Fifth wheel jaws locked on the kingpin; release handle in the locked position; no gap between plates",
    "Safety chains / secondary coupling attached, where fitted (drawbar trailers)",
    "Landing legs fully raised and handle stowed"]}]},
   {k:"s7",title:"7. Body & deck",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "No visible cracks or damage on chassis rails and cross-members",
    "Deck boards / floor sound; no holes, broken or loose boards",
    "Headboard secure and undamaged (where fitted)","Side gates, pins and latches present and working",
    "Curtains, straps and buckles intact; no tears (curtain-siders)",
    "Twist locks present, free-moving and undamaged (container carriers)"]}]},
   {k:"s8",title:"8. Mirrors, windscreen & wipers",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Mirrors present, secure and not cracked","Windscreen not cracked or damaged in the driver's line of sight",
    "Wipers and washers working; blades not worn"]}]},
   {k:"s9",title:"9. Fluid leaks",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "No fuel, oil, coolant or hydraulic leaks under the vehicle or trailer (GP: check ground before moving)",
    "Fuel cap present and secure (GP)"]}]},
   {k:"s10",title:"10. Safety equipment",photos:true,fields:[{t:"checks",labels:OKDEF,items:[
    "Warning triangle(s) on board and in good condition (GP: carry at least two)",
    "Fire extinguisher on board, charged and in date (GP; required for some loads, e.g. dangerous goods)"]}]},
   {k:"s11",title:"11. Driver fit-to-drive observation (GP)",photos:false,fields:[{t:"checks",labels:OKDEF,items:[
    "Driver appears alert and well rested (no obvious signs of fatigue)",
    "No obvious signs of alcohol or drug impairment","Driver wearing required PPE on site (GP)"]},
    {t:"note",text:"Observation only, not a medical or sobriety test. Raise concerns with the transporter before loading."}]},
   {k:"s12",title:"12. Outcome",photos:true,fields:[
    {t:"choice",k:"outcome",label:"Outcome",req:true,big:true,opts:["OK TO LOAD","LOAD REFUSED (defects listed below)","OK to load after defect corrected"]},
    {t:"rows",k:"defects",label:"Defects found",autoDefects:true,cols:[{k:"defect",label:"Defect found (section / item no.)"},{k:"action",label:"Action taken / required"},{k:"corrected",label:"Corrected?",yn:true}]}]},
   {k:"s13",title:"13. Sign-offs",photos:false,fields:[
    {t:"note",text:"The driver confirms the outcome above was explained and that any defects listed were brought to their attention."},
    {t:"sigs",roles:[{k:"loadmaster",label:"Loadmaster (IPS)"},{k:"driver",label:"Driver"}]},
    {t:"note",cls:"small",text:"This visual check does not certify roadworthiness and does not transfer responsibility for the vehicle from its owner, operator or driver. It reflects what was seen at the time of inspection only."}]}
  ]},
 ls: {
  id:"ls", title:"Load Securing Checklist", short:"Load securing",
  subtitle:"Completed by the IPS loadmaster for every vehicle, before departure\nRef: Regulation 246, National Road Traffic Regulations | SANS 10187 principles",
  sections:[
   {k:"s1",title:"1. Job & vehicle details",photos:true,fields:[
     {t:"text",k:"rep",label:"REP no.",ro:true},{t:"text",k:"datetime",label:"Date / time",ro:true},
     {t:"text",k:"location",label:"Location / area",req:true},{t:"text",k:"vehicle_reg",label:"Vehicle reg.",req:true,upper:true},
     {t:"text",k:"trailer_reg",label:"Trailer reg.",upper:true},{t:"text",k:"container_no",label:"Container no.",upper:true},
     {t:"text",k:"consignor",label:"Consignor",req:true},{t:"text",k:"seal_no",label:"Seal no.",upper:true},
     {t:"text",k:"driver",label:"Driver name",req:true},{t:"text",k:"loadmaster",label:"Loadmaster",req:true},
     {t:"choice",k:"trailer_type",label:"Trailer type",opts:TRAILER_TYPES,other:true,req:true}]},
   {k:"s2",title:"2. Pre-load vehicle inspection",photos:true,fields:[{t:"checks",labels:YESNO,items:[
    "Deck / floor sound, dry, clean and free of oil, grease, debris and loose items",
    "Headboard / bulkhead present and undamaged (where fitted)",
    "Anchor points, lashing rails and stake pockets intact; no cracks, deformation or missing parts",
    "Side gates, curtains, doors and rear frame in serviceable condition and able to close",
    "Lashing equipment inspected: labels legible; no cuts, knots, burns or worn ratchets (damaged items removed from use)"]}]},
   {k:"s3",title:"3. Load distribution & weight",photos:true,fields:[{t:"checks",labels:YESNO,items:[
    "Load mass known (weighbridge ticket or declared mass) and vehicle within its legal mass limits (GVM / axle loads)",
    "Load spread evenly across the deck and between axles; no axle or side overloaded",
    "Centre of gravity kept as low as possible and close to the vehicle's centreline; heavy items at the bottom",
    "Load placed against the headboard, or blocked to prevent forward movement",
    "Load within permitted height and width; any projection within legal limits and marked as required"]},
    {t:"text",k:"load_mass",label:"Load mass (kg)",type:"number",req:true},
    {t:"choice",k:"mass_source",label:"Source",req:true,opts:["Weighbridge ticket","Declared by consignor"]},
    {t:"text",k:"weighbridge_no",label:"Weighbridge ticket no.",showIf:["mass_source","Weighbridge ticket"]}]},
   {k:"s4",title:"4. Restraint method & lashings",photos:true,fields:[
    {t:"choice",k:"method",label:"Method",req:true,opts:["Blocking / bracing","Top-over (friction) lashing","Direct lashing","Twist locks","Combination"]},
    {t:"checks",labels:YESNO,items:[
    "Load is restrained so it cannot move in any direction: forward, rearward, sideways or upward (SANS 10187)",
    "All lashings conform to SANS 52195 and carry a legible label showing their rated capacity (WLL / LC)",
    "Lashing angles are 60\u00b0 or less","All lashings tensioned; ratchet handles closed and locked; loose tails tied off",
    "Goods safely contained or securely fastened and protected from being dislodged or spilled (Reg. 246)",
    "Tarpaulin / curtains used for weather protection only; NOT counted as part of the load restraint"]},
    {t:"lashings",k:"lashings"}]},
   {k:"s5",title:"5. Edge protectors & dunnage",photos:true,fields:[{t:"checks",labels:YESNO,items:[
    "Edge protectors fitted wherever a lashing passes over an edge or corner of the load",
    "Anti-slip matting used where friction is relied on",
    "Gaps and voids filled with dunnage, blocks or void fillers so the load cannot shift",
    "Dunnage and blocking material in sound condition and correctly positioned"]},
    {t:"text",k:"edge_qty",label:"Edge protectors used",type:"number"},{t:"text",k:"mats_qty",label:"Anti-slip mats",type:"number"},
    {t:"text",k:"dunnage_qty",label:"Dunnage / blocks",type:"number"}]},
   {k:"s6",title:"6. Container & twist-lock check (container loads only)",photos:true,fields:[
    {t:"choice",k:"container_len",label:"Container length",opts:["20 ft","40 ft","Other"],other:true,otherLabel:"Length (m)"},
    {t:"checks",labels:YESNO,items:[
    "At least 4 twist locks engaged (at least 2 for a container from 1.5 m to under 3 m long) (Reg. 246)",
    "Every twist lock fully engaged and locked; handles in the locked position",
    "Container sits square and flat on all corner castings",
    "Container doors closed; seal fitted and seal no. matches the documents"]},
    {t:"text",k:"tl_engaged",label:"Twist locks engaged",type:"number"},{t:"text",k:"tl_of",label:"of",type:"number"}]},
   {k:"s7",title:"7. Final walk-around (before departure)",photos:true,fields:[{t:"checks",labels:YESNO,items:[
    "Full 360\u00b0 walk-around completed; all lashings re-checked for tension",
    "No loose items, offcuts, packaging or debris on the load or deck that could be dislodged or blown off",
    "Gates, doors and curtains closed and secured",
    "Driver briefed on the restraint used and on checking the load during the trip"]}]},
   {k:"s8",title:"8. Photos taken",photos:false,fields:[
    {t:"choice",k:"photos_taken",label:"Photos taken",multi:true,opts:["Front","Rear","Left side","Right side","Lashings / edge protectors","Twist locks","Seal","Number plate"]},
    {t:"photocount"},{t:"text",k:"photo_ref",label:"Stored at / reference"}]},
   {k:"s9",title:"9. Defects / comments / corrective action",photos:false,fields:[{t:"textarea",k:"comments",label:"Defects / comments / corrective action"}]},
   {k:"s10",title:"10. Sign-offs",photos:false,fields:[
    {t:"note",text:"By signing, each party confirms that the load was checked as recorded above at the time of departure."},
    {t:"sigs",roles:[{k:"loadmaster",label:"Loadmaster (IPS)"},{k:"driver",label:"Driver"},{k:"consignor",label:"Consignor representative"}]},
    {t:"text",k:"cert_no",label:"Load Securing Certificate issued \u2013 No.",ro:true},
    {t:"note",cls:"small",text:"This checklist is a practical aid for recording the securing of each load. It does not replace Regulation 246 of the National Road Traffic Regulations or SANS 10187, which should be consulted for full requirements."}]}
  ]},
 cert: {
  id:"cert", title:"Load Securing Certificate", short:"Certificate", subtitle:"International Packaging Solutions (PTY) Ltd",
  sections:[
   {k:"s0",title:"Certificate",photos:false,fields:[
    {t:"text",k:"cert_no",label:"Certificate no.",ro:true},{t:"text",k:"date",label:"Date",ro:true},
    {t:"note",cls:"statement",html:"This is to certify that the load described below was <b>inspected and secured by an IPS loadmaster</b> in accordance with <b>Regulation 246 of the National Road Traffic Regulations</b> and the principles of <b>SANS 10187</b>, so that, at the time of departure, the goods were safely contained or securely fastened and protected from being dislodged or spilled, and restrained against movement in any direction."}]},
   {k:"s1",title:"Vehicle & load details",photos:false,fields:[
    {t:"text",k:"vehicle_reg",label:"Vehicle reg.",req:true,upper:true},{t:"text",k:"trailer",label:"Trailer reg. / type"},
    {t:"text",k:"container_no",label:"Container no.",upper:true},{t:"text",k:"seal_no",label:"Seal no.",upper:true},
    {t:"textarea",k:"load_desc",label:"Load description",req:true},
    {t:"text",k:"weight",label:"Weight (kg)",type:"number",req:true},
    {t:"choice",k:"weight_source",label:"Weight source",req:true,opts:["Weighbridge","Declared"]},
    {t:"choice",k:"method",label:"Restraint method",multi:true,req:true,other:true,opts:["Blocking / bracing","Top-over lashing","Direct lashing","Twist locks","Other"]},
    {t:"text",k:"lashings",label:"Lashings (qty / WLL each)"},{t:"text",k:"edge",label:"Edge protectors used"},
    {t:"text",k:"rep",label:"Checklist / REP no.",ro:true},{t:"text",k:"location",label:"Loading location",req:true}]},
   {k:"s2",title:"Issued by IPS loadmaster",photos:false,fields:[
    {t:"text",k:"departure",label:"Date / time of departure",type:"datetime-local",req:true},
    {t:"sigs",roles:[{k:"loadmaster",label:"Loadmaster"}]},
    {t:"note",cls:"small",text:"Company stamp: applied on printed copy if required."}]},
   {k:"s3",title:"Driver acknowledgement",photos:false,fields:[
    {t:"note",text:"I confirm that the load was secured as described above before departure, that I have been shown the restraint used, and that I will check the load and lashings during the journey."},
    {t:"text",k:"driver_licence",label:"Driver licence no.",upper:true},
    {t:"sigs",roles:[{k:"driver",label:"Driver"}]}]},
   {k:"s4",title:"Disclaimer",photos:false,fields:[{t:"note",cls:"small",html:"<b>Disclaimer:</b> This certificate covers the condition of the load and its securing at the time of departure from the loading point only. International Packaging Solutions (PTY) Ltd is not responsible for any change to the load or its restraint after departure, including removal, loosening or re-positioning of lashings, loading or off-loading of goods en route, tampering, or the effects of driving and road conditions. Checking the load during the journey remains the responsibility of the driver and vehicle operator. This certificate does not certify the roadworthiness of the vehicle, the accuracy of a load mass declared by others, or the treatment or condition of packaging or timber."}]}
  ]}
};
const CO="International Packaging Solutions (PTY) Ltd", CONTACT="Rynfield, Benoni  |  082 450 5688  |  ips-packaging.co.za";
