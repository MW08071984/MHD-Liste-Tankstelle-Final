// ABSCHRIFT BESTAND FIX

const increaseMenge = () => {
  setMenge((old) => {
    if (old >= artikel.bestand) return old;
    return old + 1;
  });
};

const decreaseMenge = () => {
  setMenge((old) => {
    if (old <= 0) return 0;
    return old - 1;
  });
};

const saveAbschrift = async () => {
  if (menge > artikel.bestand) {
    alert("Nicht genügend Bestand vorhanden");
    return;
  }

  // speichern...
};

// INPUT

<input
  type="number"
  min="0"
  max={artikel.bestand}
  value={menge}
  onChange={(e) => {
    let value = Number(e.target.value);

    if (value > artikel.bestand) {
      value = artikel.bestand;
    }

    if (value < 0) {
      value = 0;
    }

    setMenge(value);
  }}
/>
