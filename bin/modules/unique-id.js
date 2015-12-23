var unique_id = {
    base: null,
    index: 1
};

module.exports = function() {
    var base;
    var date;

    //get the current date (minus year information)
    date = new Date();

    //get the base value
    base = date.valueOf().toString(36);

    //if the base has not changed since last request then increment the index, otherwise update the base and reset the index
    if (base === unique_id.base) {
        unique_id.index++;
    } else {
        unique_id.base = base;
        unique_id.index = 1;
    }

    //return the new id
    return base + ("0000" + unique_id.index.toString(36)).substr(-4, 4);
};